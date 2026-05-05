'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import type { ATSResult } from '@/services/ats';
import { getAnalysis, type SingleAnalysisResponse } from '@/services/dashboardService';

const ATS_STORAGE_KEY = 'ats_result';

type DisplayResult = {
  ats_score: number;
  match_percentage: number | null;
  matching_skills: string[];
  experience_fit: string | null;
  strengths: string[];
  weaknesses: string[];
  missing_keywords: string[];
  formatting_feedback: string | null;
  match_report: string | null;
  jd_title?: string | null;
  timestamp?: string | null;
};

function scoreColor(score: number) {
  if (score >= 70) return { ring: 'stroke-emerald-400', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', label: 'Strong Match' };
  if (score >= 45) return { ring: 'stroke-amber-400', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', label: 'Moderate Match' };
  return { ring: 'stroke-red-400', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300 border-red-500/30', label: 'Low Match' };
}

function ScoreRing({ score }: { score: number }) {
  const colors = scoreColor(score);
  const r = 80;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="200" height="200" className="-rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          className={colors.ring}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: 'stroke-dasharray 1s ease-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-6xl font-black tabular-nums ${colors.text}`}>{score}</span>
        <span className="text-white/50 text-sm font-medium tracking-widest uppercase">/ 100</span>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children, fullWidth = false }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-6 flex flex-col gap-4 ${fullWidth ? 'col-span-full' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h2 className="text-white font-semibold text-base">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function TagList({ items, color }: { items: string[]; color: string }) {
  if (!items.length) return <p className="text-white/40 text-sm italic">None identified.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={i} className={`px-3 py-1 rounded-full text-xs font-medium border ${color}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function BulletList({ items, variant }: { items: string[]; variant: 'positive' | 'negative' }) {
  if (!items.length) return <p className="text-white/40 text-sm italic">None identified.</p>;
  const dotClass = variant === 'positive' ? 'bg-emerald-400' : 'bg-red-400';
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-indigo-100 leading-relaxed">
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function fromBackend(a: SingleAnalysisResponse): DisplayResult {
  return {
    ats_score: a.ats_score,
    match_percentage: a.match_percentage,
    matching_skills: a.matching_skills ?? [],
    experience_fit: a.experience_fit,
    strengths: a.strengths ?? [],
    weaknesses: a.weaknesses ?? [],
    missing_keywords: a.missing_keywords ?? [],
    formatting_feedback: a.formatting_feedback,
    match_report: a.match_report,
    jd_title: a.jd_title,
    timestamp: a.timestamp,
  };
}

function fromSession(r: ATSResult): DisplayResult {
  return {
    ats_score: r.ats_score,
    match_percentage: r.match_percentage,
    matching_skills: r.matching_skills ?? [],
    experience_fit: r.experience_fit,
    strengths: r.strengths ?? [],
    weaknesses: r.weaknesses ?? [],
    missing_keywords: r.missing_keywords ?? [],
    formatting_feedback: r.formatting_feedback,
    match_report: r.match_report,
  };
}

function ATSDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisId = searchParams.get('analysis_id');

  const [result, setResult] = useState<DisplayResult | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (analysisId) {
        try {
          const a = await getAnalysis(analysisId);
          if (!cancelled) setResult(fromBackend(a));
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load analysis.');
        } finally {
          if (!cancelled) setReady(true);
        }
        return;
      }

      // Fallback: post-upload flow stores the latest result in sessionStorage
      const raw = sessionStorage.getItem(ATS_STORAGE_KEY);
      if (raw) {
        try {
          setResult(fromSession(JSON.parse(raw) as ATSResult));
        } catch {
          // malformed — leave result null
        }
      }
      setReady(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900 flex items-center justify-center">
        <svg className="w-10 h-10 text-indigo-300 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">{error ? 'Analysis unavailable' : 'No Analysis Found'}</h1>
            <p className="text-indigo-200 text-sm max-w-sm">
              {error || 'Run an ATS analysis from the home page or pick one from your dashboard.'}
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const colors = scoreColor(result.ats_score);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900">
      <div className="fixed -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-700/20 blur-[100px] pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />

      <Navbar />

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-32 pb-20">

        <div className="flex flex-col items-center text-center mb-14 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-indigo-200 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            ATS Analysis
            {result.jd_title && <span className="text-white/60">· {result.jd_title}</span>}
          </div>

          <ScoreRing score={result.ats_score} />

          <p className="text-white/60 text-lg mt-1">ATS Compatibility Score</p>

          <span className={`mt-4 px-4 py-1.5 rounded-full text-sm font-semibold border ${colors.badge}`}>
            {colors.label}
          </span>

          <div className="mt-5 w-full max-w-xs flex flex-col items-center gap-2">
            <div className="flex justify-between w-full text-xs text-white/50 font-medium">
              <span>JD Match</span>
              <span className="text-white font-semibold">{result.match_percentage ?? 0}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-400 to-violet-400 h-2 rounded-full transition-all duration-700"
                style={{ width: `${result.match_percentage ?? 0}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="mt-8 px-6 py-2.5 rounded-full bg-white/10 border border-white/20 text-indigo-200 text-sm font-medium hover:bg-white/15 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          <SectionCard
            fullWidth
            title="Match Report"
            icon={
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          >
            <p className="text-indigo-100 text-sm leading-relaxed whitespace-pre-wrap">
              {result.match_report || 'No match report available.'}
            </p>
          </SectionCard>

          <SectionCard
            title="Strengths"
            icon={
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            <BulletList items={result.strengths} variant="positive" />
          </SectionCard>

          <SectionCard
            title="Weaknesses"
            icon={
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            <BulletList items={result.weaknesses} variant="negative" />
          </SectionCard>

          <SectionCard
            title="Matching Skills"
            icon={
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
          >
            <TagList
              items={result.matching_skills}
              color="bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
            />
          </SectionCard>

          <SectionCard
            title="Experience Fit"
            icon={
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          >
            <p className="text-indigo-100 text-sm leading-relaxed whitespace-pre-wrap">
              {result.experience_fit || 'No experience assessment available.'}
            </p>
          </SectionCard>

          <SectionCard
            fullWidth
            title="Missing Keywords"
            icon={
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            }
          >
            <TagList
              items={result.missing_keywords}
              color="bg-amber-500/10 text-amber-300 border-amber-500/30"
            />
          </SectionCard>

          <SectionCard
            fullWidth
            title="Formatting Feedback"
            icon={
              <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
            }
          >
            <p className="text-indigo-100 text-sm leading-relaxed whitespace-pre-wrap">
              {result.formatting_feedback || 'No formatting feedback available.'}
            </p>
          </SectionCard>

        </div>
      </main>
    </div>
  );
}

export default function ATSDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900 flex items-center justify-center">
        <svg className="w-10 h-10 text-indigo-300 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    }>
      <ATSDashboardContent />
    </Suspense>
  );
}
