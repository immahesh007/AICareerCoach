'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ResumeTable from '@/components/dashboard/ResumeTable';
import AnalyzeMoreModal from '@/components/dashboard/AnalyzeMoreModal';
import { useAuth } from '@/context/AuthContext';
import { listResumes, type ResumeListItem, type ResumeListResponse } from '@/services/dashboardService';

const PAGE_SIZE = 20;

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, token } = useAuth();
  const [authReady, setAuthReady] = useState(false);

  const page = useMemo(() => {
    const raw = Number(searchParams.get('page'));
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
  }, [searchParams]);

  const [data, setData] = useState<ResumeListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzeTarget, setAnalyzeTarget] = useState<ResumeListItem | null>(null);

  // Wait for AuthContext hydration before deciding to redirect
  useEffect(() => {
    const t = window.setTimeout(() => setAuthReady(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (authReady && !isAuthenticated) {
      router.replace('/?auth=login');
    }
  }, [authReady, isAuthenticated, router]);

  const fetchResumes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listResumes(page, PAGE_SIZE);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load resumes.');
    } finally {
      setLoading(false);
    }
  }, [page, token]);

  useEffect(() => {
    if (isAuthenticated) fetchResumes();
  }, [isAuthenticated, fetchResumes]);

  const handlePageChange = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete('page');
    else params.set('page', String(next));
    const qs = params.toString();
    router.push(qs ? `/dashboard?${qs}` : '/dashboard');
  };

  const handleAnalyzeSuccess = () => {
    setAnalyzeTarget(null);
    fetchResumes();
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
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">My Resumes</h1>
            <p className="text-indigo-200 text-sm mt-1.5">
              Manage your uploaded resumes and review their ATS analyses.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload New Resume
          </button>
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

        {data && (
          <ResumeTable
            items={data.items}
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            onPageChange={handlePageChange}
            onAnalyzeMore={(item) => setAnalyzeTarget(item)}
          />
        )}
      </main>

      {analyzeTarget && (
        <AnalyzeMoreModal
          isOpen={true}
          resumeId={analyzeTarget.resume_id}
          resumeLabel={analyzeTarget.original_filename ?? `Resume ${analyzeTarget.resume_id.slice(0, 8)}`}
          onClose={() => setAnalyzeTarget(null)}
          onSuccess={handleAnalyzeSuccess}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900 flex items-center justify-center">
        <svg className="w-10 h-10 text-indigo-300 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
