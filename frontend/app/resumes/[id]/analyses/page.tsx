'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ViewJDModal from '@/components/ats/ViewJDModal';
import { useAuth } from '@/context/AuthContext';
import {
  listAnalyses,
  type AnalysesResponse,
  type AnalysisRecord,
} from '@/services/dashboardService';

function scoreBadgeClasses(score: number): string {
  if (score >= 70) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (score >= 45) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-red-500/20 text-red-300 border-red-500/30';
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

function companyLabel(a: AnalysisRecord): string {
  return a.jd_title?.trim() || 'Untitled analysis';
}

export default function AnalysisHistoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const resumeId = params?.id;
  const { isAuthenticated } = useAuth();
  const [authReady, setAuthReady] = useState(false);

  const [data, setData] = useState<AnalysesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jdView, setJdView] = useState<AnalysisRecord | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setAuthReady(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (authReady && !isAuthenticated) router.replace('/?auth=login');
  }, [authReady, isAuthenticated, router]);

  const fetchData = useCallback(async () => {
    if (!resumeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listAnalyses(resumeId);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analyses.');
    } finally {
      setLoading(false);
    }
  }, [resumeId]);

  useEffect(() => {
    if (isAuthenticated && resumeId) fetchData();
  }, [isAuthenticated, resumeId, fetchData]);

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

  const resumeLabel = data?.original_filename || (resumeId ? `Resume ${resumeId.slice(0, 8)}` : 'Resume');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900">
      <div className="fixed -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-700/20 blur-[100px] pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />

      <Navbar />

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-28 pb-20">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-indigo-200 hover:text-white text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Analysis History</h1>
          <p className="text-indigo-200 text-sm mt-1.5 truncate">{resumeLabel}</p>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <svg className="w-8 h-8 text-indigo-300 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-4">
            {error}
          </div>
        )}

        {data && data.analyses.length === 0 && (
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-12 text-center">
            <h2 className="text-white font-semibold text-lg mb-1">No analyses yet</h2>
            <p className="text-indigo-200 text-sm">
              Run an analysis from the dashboard to compare this resume against a job description.
            </p>
          </div>
        )}

        {data && data.analyses.length > 0 && (
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 overflow-hidden">
            {/* Desktop table */}
            <table className="hidden md:table w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">ATS Score</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.analyses.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-white text-sm font-medium truncate max-w-[260px]">{companyLabel(a)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${scoreBadgeClasses(a.ats_score)}`}>
                        {a.ats_score}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-indigo-200 text-sm">{formatDate(a.timestamp)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <button
                          onClick={() => router.push(`/ats-dashboard?analysis_id=${a.id}`)}
                          className="px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setJdView(a)}
                          className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                        >
                          View JD
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile card list */}
            <ul className="md:hidden divide-y divide-white/5">
              {data.analyses.map((a) => (
                <li key={a.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white text-sm font-medium truncate">{companyLabel(a)}</div>
                      <div className="text-indigo-200/70 text-xs mt-0.5">{formatDate(a.timestamp)}</div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${scoreBadgeClasses(a.ats_score)}`}>
                      {a.ats_score}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => router.push(`/ats-dashboard?analysis_id=${a.id}`)}
                      className="px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setJdView(a)}
                      className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      View JD
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      <ViewJDModal
        isOpen={jdView !== null}
        jdText={jdView?.jd_text ?? null}
        jdTitle={jdView ? companyLabel(jdView) : null}
        onClose={() => setJdView(null)}
      />
    </div>
  );
}
