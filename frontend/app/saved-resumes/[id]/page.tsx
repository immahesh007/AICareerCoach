'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ResumePreview from '@/components/resume-builder/ResumePreview';
import { useAuth } from '@/context/AuthContext';
import { getSavedResume, type SavedResumeFull } from '@/services/savedResumesService';
import { DEFAULT_DESIGN_SETTINGS } from '@/types/resume';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function SavedResumeViewer() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const wantsDownload = searchParams.get('download') === '1';

  const { isAuthenticated } = useAuth();
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<SavedResumeFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setAuthReady(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (authReady && !isAuthenticated) router.replace('/?auth=login');
  }, [authReady, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSavedResume(id)
      .then(res => {
        if (!cancelled) setData(res);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load resume.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, id]);

  const handlePrint = useCallback(() => {
    if (!data) return;
    const previousTitle = document.title;
    document.title = (data.name || 'Resume').trim();
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }, [data]);

  // Auto-trigger print when the user clicked "Download" on the listing page.
  useEffect(() => {
    if (wantsDownload && data && !loading) {
      const t = window.setTimeout(() => handlePrint(), 400);
      return () => window.clearTimeout(t);
    }
  }, [wantsDownload, data, loading, handlePrint]);

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

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-28 pb-20">
        <Link
          href="/saved-resumes"
          className="inline-flex items-center gap-1.5 text-indigo-200 hover:text-white text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to saved resumes
        </Link>

        {loading && (
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
          <>
            <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{data.name}</h1>
                <p className="text-indigo-200 text-sm mt-1.5">
                  {data.company && <span>{data.company} · </span>}
                  Saved {formatDate(data.saved_at)}
                </p>
              </div>
              <button
                onClick={handlePrint}
                className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download (PDF)
              </button>
            </div>

            <div className="rounded-2xl bg-gray-200/10 p-4 overflow-auto">
              <div className="w-fit mx-auto">
                <ResumePreview data={data.resume_data} design={data.design ?? DEFAULT_DESIGN_SETTINGS} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function SavedResumeViewerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900 flex items-center justify-center">
        <svg className="w-10 h-10 text-indigo-300 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    }>
      <SavedResumeViewer />
    </Suspense>
  );
}
