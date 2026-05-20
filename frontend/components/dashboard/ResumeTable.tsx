'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getResumeDownloadUrl, type ResumeListItem } from '@/services/dashboardService';

interface Props {
  items: ResumeListItem[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onAnalyzeMore: (resume: ResumeListItem) => void;
  onFindMatchingJobs: (resume: ResumeListItem) => void;
}

function displayName(item: ResumeListItem): string {
  if (item.original_filename) return item.original_filename;
  if (item.uploaded_at) {
    return `Resume ${item.uploaded_at.slice(0, 10)}`;
  }
  return `Resume ${item.resume_id.slice(0, 8)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ResumeTable({
  items,
  page,
  pageSize,
  total,
  onPageChange,
  onAnalyzeMore,
  onFindMatchingJobs,
}: Props) {
  const router = useRouter();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleViewResume = async (item: ResumeListItem) => {
    setError(null);
    setDownloadingId(item.resume_id);
    try {
      const { url } = await getResumeDownloadUrl(item.resume_id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open resume.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewAnalyses = (item: ResumeListItem) => {
    router.push(`/resumes/${item.resume_id}/analyses`);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/10 mx-auto flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-white font-semibold text-lg mb-1">No resumes yet</h2>
        <p className="text-indigo-200 text-sm">Upload one from the home page to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 overflow-hidden">
        {/* Desktop table */}
        <table className="hidden md:table w-full">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
              <th className="px-6 py-4">Resume</th>
              <th className="px-6 py-4">Uploaded</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.resume_id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-white text-sm font-medium truncate max-w-[320px]">{displayName(item)}</div>
                </td>
                <td className="px-6 py-4 text-indigo-200 text-sm">{formatDate(item.uploaded_at)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    {item.has_parsed_data && (
                      <button
                        onClick={() => onFindMatchingJobs(item)}
                        className="px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                        </svg>
                        Find Matching Jobs
                      </button>
                    )}
                    <button
                      onClick={() => handleViewResume(item)}
                      disabled={downloadingId === item.resume_id}
                      className="px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                    >
                      {downloadingId === item.resume_id ? 'Opening…' : 'View Resume'}
                    </button>
                    <button
                      onClick={() => onAnalyzeMore(item)}
                      className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                    >
                      Analyze More
                    </button>
                    <button
                      onClick={() => handleViewAnalyses(item)}
                      className="px-3 py-1.5 rounded-full border border-white/20 hover:border-white/40 text-white/80 hover:text-white text-xs font-semibold transition-colors"
                    >
                      View Analyses
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile card list */}
        <ul className="md:hidden divide-y divide-white/5">
          {items.map((item) => (
            <li key={item.resume_id} className="px-5 py-4 space-y-3">
              <div>
                <div className="text-white text-sm font-medium truncate">{displayName(item)}</div>
                <div className="text-indigo-200/70 text-xs mt-0.5">{formatDate(item.uploaded_at)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.has_parsed_data && (
                  <button
                    onClick={() => onFindMatchingJobs(item)}
                    className="px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                    </svg>
                    Find Matching Jobs
                  </button>
                )}
                <button
                  onClick={() => handleViewResume(item)}
                  disabled={downloadingId === item.resume_id}
                  className="px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {downloadingId === item.resume_id ? 'Opening…' : 'View Resume'}
                </button>
                <button
                  onClick={() => onAnalyzeMore(item)}
                  className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  Analyze More
                </button>
                <button
                  onClick={() => handleViewAnalyses(item)}
                  className="px-3 py-1.5 rounded-full border border-white/20 text-white/80 text-xs font-semibold"
                >
                  View Analyses
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/50">
            Page {page} of {totalPages} · {total} resume{total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
