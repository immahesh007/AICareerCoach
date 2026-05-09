'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import SuggestionReview from '@/components/resume-builder/SuggestionReview';
import { useAuth } from '@/context/AuthContext';

export default function SuggestionsPage() {
  const router = useRouter();
  const params = useParams<{ id: string; analysisId: string }>();
  const resumeId = params?.id;
  const analysisId = params?.analysisId;
  const { isAuthenticated } = useAuth();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setAuthReady(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (authReady && !isAuthenticated) router.replace('/?auth=login');
  }, [authReady, isAuthenticated, router]);

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
          href={resumeId ? `/resumes/${resumeId}/analyses` : '/dashboard'}
          className="inline-flex items-center gap-1.5 text-indigo-200 hover:text-white text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to analyses
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Improve with AI</h1>
          <p className="text-indigo-200 text-sm mt-1.5">
            Approve or reject each suggestion. Approved changes will prefill the resume builder.
          </p>
        </div>

        {analysisId && resumeId && (
          <SuggestionReview evaluationId={analysisId} resumeId={resumeId} />
        )}
      </main>
    </div>
  );
}
