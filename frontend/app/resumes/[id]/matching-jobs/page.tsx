'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import {
  triggerMatchJobs,
  getMatchingJobs,
  generateResumes,
  getBatchStatus,
  type MatchJob,
  type MatchJobsResponse,
  type BatchTask,
} from '@/services/jobMatchService';

function scoreBadge(score: number) {
  if (score >= 70) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (score >= 45) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-red-500/20 text-red-300 border-red-500/30';
}

export default function MatchingJobsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const resumeId = params?.id;
  const { isAuthenticated } = useAuth();
  const [authReady, setAuthReady] = useState(false);

  const [data, setData] = useState<MatchJobsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Batch state
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchTasks, setBatchTasks] = useState<BatchTask[]>([]);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Overwrite confirmation
  const [overwriteCount, setOverwriteCount] = useState(0);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);

  // Auth guard
  useEffect(() => {
    const t = window.setTimeout(() => setAuthReady(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (authReady && !isAuthenticated) router.replace('/?auth=login');
  }, [authReady, isAuthenticated, router]);

  // Initial fetch — triggers match API, then reads paginated cache
  const fetchPage = useCallback(async (p: number) => {
    if (!resumeId) return;
    setLoading(true);
    setError(null);
    try {
      // First visit: trigger the match
      let result = await triggerMatchJobs(resumeId);
      // If cached, read directly; if not, we already got page 1
      if (result.cached || p > 1) {
        result = await getMatchingJobs(resumeId, p);
      }
      setData(result);
      setPage(result.page);

      // Auto-select top 10 on first load
      if (p === 1 && selectedJobs.size === 0) {
        const top10 = result.items.slice(0, 10).map(j => j.job_id);
        setSelectedJobs(new Set(top10));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to find matching jobs.');
    } finally {
      setLoading(false);
    }
  }, [resumeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isAuthenticated && resumeId) fetchPage(page);
  }, [isAuthenticated, resumeId, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll batch status
  const startPolling = useCallback((id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await getBatchStatus(id);
        setBatchTasks(status.tasks);
        setBatchStatus(status.status);
        if (status.status === 'completed' || status.status === 'partial') {
          if (pollRef.current) clearInterval(pollRef.current);
          setGenerating(false);
          // Refetch table so persistent generated_id values appear in rows
          fetchPage(page);
        }
      } catch {
        // silent poll failure
      }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const toggleJob = (jobId: string) => {
    setSelectedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const toggleExpand = (jobId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const selectAll = () => {
    if (!data) return;
    setSelectedJobs(new Set(data.items.map(j => j.job_id)));
  };

  const deselectAll = () => {
    setSelectedJobs(new Set());
  };

  const doGenerate = useCallback(async () => {
    if (!resumeId || selectedJobs.size === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generateResumes(resumeId, Array.from(selectedJobs));
      setBatchId(res.batch_id);
      setBatchStatus('pending');
      setBatchTasks([]);
      startPolling(res.batch_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start generation.');
      setGenerating(false);
    }
  }, [resumeId, selectedJobs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = useCallback(async () => {
    if (!resumeId || selectedJobs.size === 0 || !data) return;
    const overwrites = data.items.filter(
      j => selectedJobs.has(j.job_id) && j.generated_id
    );
    if (overwrites.length > 0) {
      setOverwriteCount(overwrites.length);
      setShowOverwriteDialog(true);
      return;
    }
    await doGenerate();
  }, [resumeId, selectedJobs, data, doGenerate]);

  const confirmOverwrite = useCallback(async () => {
    setShowOverwriteDialog(false);
    await doGenerate();
  }, [doGenerate]);

  const handleViewResume = (generatedId: string) => {
    router.push(`/resume-builder?generated_id=${generatedId}`);
  };

  if (!authReady || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900 flex items-center justify-center">
        <svg className="w-10 h-10 text-indigo-300 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900">
      <div className="fixed -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-700/20 blur-[100px] pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />

      <Navbar />

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-20">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-indigo-200 hover:text-white text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Matching Jobs</h1>
            <p className="text-indigo-200 text-sm mt-1.5">
              {data ? `${data.total} jobs matched` : 'Find jobs that match your resume.'}
            </p>
          </div>

          {/* Generate button */}
          {data && data.items.length > 0 && !generating && !batchId && (
            <button
              onClick={handleGenerate}
              disabled={selectedJobs.size === 0}
              className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-950 text-sm font-semibold transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Resumes ({selectedJobs.size})
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-4 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => fetchPage(page)}
              className="shrink-0 px-3 py-1 rounded-full border border-red-500/30 hover:bg-red-500/20 text-red-200 text-xs font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="w-8 h-8 text-indigo-300 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Empty */}
        {!loading && data && data.items.length === 0 && (
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-12 text-center">
            <h2 className="text-white font-semibold text-lg mb-1">No matching jobs found</h2>
            <p className="text-indigo-200 text-sm">Try updating your resume with more details and re-run the match.</p>
          </div>
        )}

        {/* Batch progress */}
        {(generating || batchId) && (
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              {batchStatus !== 'completed' && batchStatus !== 'partial' ? (
                <svg className="w-5 h-5 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="text-white font-semibold">
                {batchStatus === 'completed' ? 'All resumes generated!' :
                 batchStatus === 'partial' ? 'Resumes generated (some failed)' :
                 'Generating resumes...'}
              </span>
            </div>

            {batchTasks.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {batchTasks.map(task => (
                  <div key={task.task_id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="text-white/80 truncate">
                        {task.job_title || 'Unknown'} {task.company ? `— ${task.company}` : ''}
                      </div>
                      {task.error_message && (
                        <div className="text-red-300/80 text-xs mt-0.5 truncate">{task.error_message}</div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {task.status === 'completed' && (
                        <>
                          <span className="text-emerald-400 text-xs font-medium">Done</span>
                          {task.generated_id && (
                            <button
                              onClick={() => handleViewResume(task.generated_id!)}
                              className="px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                            >
                              View Resume
                            </button>
                          )}
                        </>
                      )}
                      {task.status === 'processing' && (
                        <span className="text-amber-400 text-xs font-medium">Processing...</span>
                      )}
                      {task.status === 'pending' && (
                        <span className="text-white/40 text-xs">Waiting</span>
                      )}
                      {task.status === 'failed' && (
                        <span className="text-red-400 text-xs font-medium">Failed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Job table */}
        {data && data.items.length > 0 && (
          <div className="space-y-4">
            {/* Selection controls */}
            <div className="flex items-center gap-3">
              <button onClick={selectAll} className="text-xs text-indigo-300 hover:text-white transition-colors">
                Select All
              </button>
              <button onClick={deselectAll} className="text-xs text-indigo-300 hover:text-white transition-colors">
                Deselect All
              </button>
              <span className="text-xs text-white/40">
                {selectedJobs.size} selected
              </span>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 overflow-hidden">
              <table className="hidden md:table w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                    <th className="px-4 py-4 w-10"></th>
                    <th className="px-4 py-4">Title</th>
                    <th className="px-4 py-4">Company</th>
                    <th className="px-4 py-4">Location</th>
                    <th className="px-4 py-4 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((job) => (
                    <Row
                      key={job.job_id}
                      job={job}
                      selected={selectedJobs.has(job.job_id)}
                      expanded={expandedRows.has(job.job_id)}
                      onToggle={() => toggleJob(job.job_id)}
                      onExpand={() => toggleExpand(job.job_id)}
                      onViewResume={handleViewResume}
                    />
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <ul className="md:hidden divide-y divide-white/5">
                {data.items.map((job) => (
                  <MobileRow
                    key={job.job_id}
                    job={job}
                    selected={selectedJobs.has(job.job_id)}
                    expanded={expandedRows.has(job.job_id)}
                    onToggle={() => toggleJob(job.job_id)}
                    onExpand={() => toggleExpand(job.job_id)}
                    onViewResume={handleViewResume}
                  />
                ))}
              </ul>
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">
                  Page {data.page} of {data.total_pages} · {data.total} jobs
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(data.page - 1)}
                    disabled={data.page <= 1}
                    className="px-3 py-1.5 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(data.page + 1)}
                    disabled={data.page >= data.total_pages}
                    className="px-3 py-1.5 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Overwrite confirmation dialog */}
      {showOverwriteDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setShowOverwriteDialog(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-indigo-950/95 shadow-2xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white mb-1">Already generated?</h2>
            <p className="text-xs text-indigo-200 mb-5">
              {overwriteCount} job{overwriteCount !== 1 ? 's' : ''} you selected
              already {overwriteCount !== 1 ? 'have' : 'has'} a generated resume.
              Generating again will overwrite the existing one.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowOverwriteDialog(false)}
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold border border-white/15 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmOverwrite}
                className="px-5 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-indigo-950 text-xs font-semibold transition-colors"
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Desktop row ─────────────────────────────────────────────────────────

function Row({
  job,
  selected,
  expanded,
  onToggle,
  onExpand,
  onViewResume,
}: {
  job: MatchJob;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onViewResume: (generatedId: string) => void;
}) {
  return (
    <>
      <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
        <td className="px-4 py-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="w-4 h-4 rounded border-white/30 bg-white/10 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
          />
        </td>
        <td className="px-4 py-4">
          <button onClick={onExpand} className="text-white text-sm font-medium text-left hover:text-amber-300 transition-colors">
            {job.title}
          </button>
        </td>
        <td className="px-4 py-4 text-indigo-200 text-sm">{job.company}</td>
        <td className="px-4 py-4 text-indigo-200/70 text-sm">{job.location}</td>
        <td className="px-4 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {job.generated_id && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewResume(job.generated_id!); }}
                className="px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors"
              >
                View Resume
              </button>
            )}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${scoreBadge(job.final_score)}`}>
              {job.final_score.toFixed(0)}
            </span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/5 bg-white/[0.03]">
          <td colSpan={5} className="px-8 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-white/50 block mb-1">Skills Score</span>
                <span className="text-white font-semibold">{job.score_breakdown.skills_score}%</span>
              </div>
              <div>
                <span className="text-white/50 block mb-1">Experience Score</span>
                <span className="text-white font-semibold">{job.score_breakdown.experience_score}%</span>
              </div>
              <div>
                <span className="text-white/50 block mb-1">Semantic Score</span>
                <span className="text-white font-semibold">{job.score_breakdown.semantic_score}%</span>
              </div>
              <div>
                <span className="text-white/50 block mb-1">Education Score</span>
                <span className="text-white font-semibold">{job.score_breakdown.education_score}%</span>
              </div>
            </div>
            {job.matched_skills.length > 0 && (
              <div className="mt-3">
                <span className="text-white/50 text-xs block mb-1">Matched Skills</span>
                <div className="flex flex-wrap gap-1">
                  {job.matched_skills.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/30">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {job.missing_skills.length > 0 && (
              <div className="mt-2">
                <span className="text-white/50 text-xs block mb-1">Missing Skills</span>
                <div className="flex flex-wrap gap-1">
                  {job.missing_skills.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs border border-red-500/30">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-2 text-white/50 text-xs">{job.reason}</div>
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                View job post
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Mobile row ──────────────────────────────────────────────────────────

function MobileRow({
  job,
  selected,
  expanded,
  onToggle,
  onExpand,
  onViewResume,
}: {
  job: MatchJob;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onViewResume: (generatedId: string) => void;
}) {
  return (
    <li className="px-5 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 w-4 h-4 rounded border-white/30 bg-white/10 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
        />
        <div className="min-w-0 flex-1">
          <button onClick={onExpand} className="text-white text-sm font-medium text-left hover:text-amber-300 transition-colors">
            {job.title}
          </button>
          <div className="text-indigo-200/70 text-xs mt-0.5">
            {job.company} {job.location ? `· ${job.location}` : ''}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {job.generated_id && (
            <button
              onClick={() => onViewResume(job.generated_id!)}
              className="px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors"
            >
              View Resume
            </button>
          )}
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${scoreBadge(job.final_score)}`}>
            {job.final_score.toFixed(0)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="pl-7 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-white/50">Skills:</span> <span className="text-white">{job.score_breakdown.skills_score}%</span></div>
            <div><span className="text-white/50">Experience:</span> <span className="text-white">{job.score_breakdown.experience_score}%</span></div>
            <div><span className="text-white/50">Semantic:</span> <span className="text-white">{job.score_breakdown.semantic_score}%</span></div>
            <div><span className="text-white/50">Education:</span> <span className="text-white">{job.score_breakdown.education_score}%</span></div>
          </div>
          {job.matched_skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {job.matched_skills.map(s => (
                <span key={s} className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/30">{s}</span>
              ))}
            </div>
          )}
          {job.missing_skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {job.missing_skills.map(s => (
                <span key={s} className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs border border-red-500/30">{s}</span>
              ))}
            </div>
          )}
          <div className="text-white/50">{job.reason}</div>
        </div>
      )}
    </li>
  );
}
