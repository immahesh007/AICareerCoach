'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getLatestSuggestion,
  recordSuggestionDecisions,
  suggestModifications,
  type SuggestModificationsResponse,
} from '@/services/dashboardService';

export const SUGGESTION_HANDOFF_KEY = 'resumeBuilderSuggestions';

export interface ApprovedSuggestionsHandoff {
  evaluation_id: string;
  resume_id: string;
  summary: string | null;
  skills: string[];
  experience: Array<{
    experience_index: number;
    bullet_index: number;
    suggested: string;
  }>;
}

interface Props {
  evaluationId: string;
  resumeId: string;
}

const cardCls = 'rounded-xl border border-white/10 bg-white/5 p-4';
const sectionTitleCls =
  'text-xs font-semibold text-white/50 uppercase tracking-widest mb-3 border-b border-white/10 pb-2';
const labelCls = 'text-[11px] font-medium text-indigo-300 uppercase tracking-wider';

function ApproveToggle({
  approved,
  onToggle,
}: {
  approved: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={
        approved
          ? 'px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors'
          : 'px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 text-[11px] font-semibold transition-colors'
      }
      aria-pressed={approved}
    >
      {approved ? 'Approved' : 'Rejected'}
    </button>
  );
}

export default function SuggestionReview({ evaluationId, resumeId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<SuggestModificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Approval state, keyed by suggestion_id; default-approved on load
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  const applyResult = (res: SuggestModificationsResponse) => {
    setData(res);
    const initial: Record<string, boolean> = {};
    if (res.suggestions.summary) initial[res.suggestions.summary.suggestion_id] = true;
    for (const s of res.suggestions.skills) initial[s.suggestion_id] = true;
    for (const e of res.suggestions.experience) initial[e.suggestion_id] = true;
    setApproved(initial);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      let res: SuggestModificationsResponse;
      // Prefer the cached row — revisits to this page shouldn't re-run the
      // LLM (20-40s) when a suggestion already exists for this evaluation.
      try {
        res = await getLatestSuggestion(evaluationId);
      } catch {
        // No row yet — generate. If the POST fails at the HTTP layer (proxy
        // timeout) while the server-side LLM call still completes, retry the
        // GET as recovery before surfacing the error.
        try {
          res = await suggestModifications(evaluationId);
        } catch (postErr) {
          try {
            res = await getLatestSuggestion(evaluationId);
          } catch {
            if (!cancelled) {
              setError(
                postErr instanceof Error ? postErr.message : 'Could not generate suggestions.',
              );
              setLoading(false);
            }
            return;
          }
        }
      }

      if (cancelled) return;
      applyResult(res);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [evaluationId]);

  const handleRegenerate = async () => {
    if (regenerating || loading) return;
    setRegenerating(true);
    setError(null);
    try {
      // Bypass the cache: POST always generates a fresh suggestion row.
      // Fall back to GET /latest on HTTP-layer failure since the server may
      // have completed the LLM call and inserted a row anyway.
      let res: SuggestModificationsResponse;
      try {
        res = await suggestModifications(evaluationId);
      } catch (postErr) {
        try {
          res = await getLatestSuggestion(evaluationId);
        } catch {
          throw postErr;
        }
      }
      applyResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not regenerate suggestions.');
    } finally {
      setRegenerating(false);
    }
  };

  const counts = useMemo(() => {
    if (!data) return { total: 0, approved: 0 };
    let total = 0;
    let count = 0;
    if (data.suggestions.summary) {
      total += 1;
      if (approved[data.suggestions.summary.suggestion_id]) count += 1;
    }
    for (const s of data.suggestions.skills) {
      total += 1;
      if (approved[s.suggestion_id]) count += 1;
    }
    for (const e of data.suggestions.experience) {
      total += 1;
      if (approved[e.suggestion_id]) count += 1;
    }
    return { total, approved: count };
  }, [data, approved]);

  const toggle = (id: string) => setApproved(a => ({ ...a, [id]: !a[id] }));

  const handleContinue = () => {
    if (!data) return;
    const handoff: ApprovedSuggestionsHandoff = {
      evaluation_id: data.evaluation_id,
      resume_id: data.resume_id,
      summary:
        data.suggestions.summary && approved[data.suggestions.summary.suggestion_id]
          ? data.suggestions.summary.suggested
          : null,
      skills: data.suggestions.skills
        .filter(s => approved[s.suggestion_id])
        .map(s => s.skill),
      experience: data.suggestions.experience
        .filter(e => approved[e.suggestion_id])
        .map(e => ({
          experience_index: e.experience_index,
          bullet_index: e.bullet_index,
          suggested: e.suggested,
        })),
    };
    sessionStorage.setItem(SUGGESTION_HANDOFF_KEY, JSON.stringify(handoff));
    console.log('[suggestions] handoff written. resumeId(prop):', resumeId, 'handoff.resume_id:', handoff.resume_id, 'match:', resumeId === handoff.resume_id, 'handoff:', handoff);

    // Fire-and-forget: persisting decisions is for analytics, not UX. Don't
    // block navigation if the call fails — the handoff is already in session.
    void recordSuggestionDecisions(data.suggestion_id, approved).catch(() => {
      /* swallow — analytics best-effort */
    });

    router.push(`/resume-builder?resume_id=${resumeId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-indigo-200">
        <svg className="w-8 h-8 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm">Generating suggestions… this can take 20-40 seconds.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed text-white/80 text-xs font-semibold border border-white/15 transition-colors inline-flex items-center gap-2"
        >
          {regenerating ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Regenerating…
            </>
          ) : (
            'Try again'
          )}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, skills, experience } = data.suggestions;
  const noSuggestions = !summary && skills.length === 0 && experience.length === 0;

  const regenerateButton = (
    <button
      onClick={handleRegenerate}
      disabled={regenerating}
      className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed text-white/80 text-[11px] font-semibold border border-white/15 transition-colors inline-flex items-center gap-1.5"
      title="Regenerate suggestions with the latest AI model"
    >
      {regenerating ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )}
      {regenerating ? 'Regenerating…' : 'Regenerate'}
    </button>
  );

  if (noSuggestions) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        <div className={cardCls}>
          <p className="text-white/80 text-sm">
            No actionable suggestions found for this analysis. Your resume is already well aligned, or
            the analysis didn&apos;t produce enough signal to safely propose changes.
          </p>
          <div className="mt-4">{regenerateButton}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-indigo-300/80">
          Not happy with these? Generate a fresh set — takes 20-40 seconds.
        </p>
        {regenerateButton}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {summary && (
        <section>
          <p className={sectionTitleCls}>Summary</p>
          <div className={cardCls}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[11px] text-indigo-300/80">{summary.rationale}</span>
              <ApproveToggle
                approved={!!approved[summary.suggestion_id]}
                onToggle={() => toggle(summary.suggestion_id)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className={labelCls}>Current</p>
                <p className="mt-1 text-sm text-white/70 whitespace-pre-line">
                  {summary.current || <span className="italic text-white/40">No summary on file.</span>}
                </p>
              </div>
              <div>
                <p className={labelCls}>Suggested</p>
                <p className="mt-1 text-sm text-white whitespace-pre-line">{summary.suggested}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {skills.length > 0 && (
        <section>
          <p className={sectionTitleCls}>Skills to add ({skills.length})</p>
          <div className="space-y-2">
            {skills.map(s => (
              <div
                key={s.suggestion_id}
                className={`${cardCls} flex items-center justify-between gap-3`}
              >
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium">{s.skill}</p>
                  <p className="text-[11px] text-indigo-300/80 truncate">{s.rationale}</p>
                </div>
                <ApproveToggle
                  approved={!!approved[s.suggestion_id]}
                  onToggle={() => toggle(s.suggestion_id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {experience.length > 0 && (
        <section>
          <p className={sectionTitleCls}>Experience rewrites ({experience.length})</p>
          <div className="space-y-3">
            {experience.map(e => (
              <div key={e.suggestion_id} className={cardCls}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-[11px] text-indigo-300/80">
                    Position {e.experience_index + 1}, bullet {e.bullet_index + 1} — {e.rationale}
                  </span>
                  <ApproveToggle
                    approved={!!approved[e.suggestion_id]}
                    onToggle={() => toggle(e.suggestion_id)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className={labelCls}>Current</p>
                    <p className="mt-1 text-sm text-white/70">{e.current}</p>
                  </div>
                  <div>
                    <p className={labelCls}>Suggested</p>
                    <p className="mt-1 text-sm text-white">{e.suggested}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sticky bottom-0 -mx-1 px-1 py-3 bg-gradient-to-t from-indigo-950/95 to-transparent">
        <p className="text-xs text-indigo-200">
          {counts.approved} of {counts.total} suggestion{counts.total === 1 ? '' : 's'} approved.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold border border-white/15 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={regenerating}
            className="px-5 py-2 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
          >
            Continue to Builder →
          </button>
        </div>
      </div>
    </div>
  );
}
