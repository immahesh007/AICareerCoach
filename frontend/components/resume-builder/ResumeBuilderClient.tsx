'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ResumePreview from './ResumePreview';
import SaveResumeModal from './SaveResumeModal';
import { useRouter } from 'next/navigation';
import { getParsedResume, reparseResume } from '@/services/dashboardService';
import { getSavedResume } from '@/services/savedResumesService';
import { getGeneratedResume } from '@/services/jobMatchService';
import { generateSuggestions } from '@/services/resumeBuilderService';
import { parsedToBuilder, classifySkill } from '@/utils/parsedToBuilder';
import {
  SUGGESTION_HANDOFF_KEY,
  type ApprovedSuggestionsHandoff,
} from './SuggestionReview';
import type {
  Award,
  Basics,
  BulletStyle,
  EducationItem,
  ExperienceItem,
  FontFamily,
  FontSize,
  MarginSize,
  ProjectItem,
  PublicationItem,
  ResumeData,
  ResumeDesignSettings,
  SkillCategory,
  SpacingMode,
  VolunteerItem,
} from '@/types/resume';
import type { ResumeSuggestions } from '@/types/resume';
import { DEFAULT_DESIGN_SETTINGS, FONT_FAMILY_MAP } from '@/types/resume';

function readHandoff(resumeId: string): ApprovedSuggestionsHandoff | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(SUGGESTION_HANDOFF_KEY);
  console.log('[suggestions] readHandoff — urlResumeId:', resumeId, 'sessionStorage raw:', raw);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ApprovedSuggestionsHandoff;
    console.log('[suggestions] handoff parsed — handoff.resume_id:', parsed.resume_id, 'match:', parsed.resume_id === resumeId);
    if (parsed.resume_id !== resumeId) return null;
    return parsed;
  } catch (err) {
    console.warn('[suggestions] handoff parse error:', err);
    return null;
  }
}

function applyHandoff(base: ResumeData, h: ApprovedSuggestionsHandoff): ResumeData {
  const next: ResumeData = {
    ...base,
    skillCategories: base.skillCategories.map(s => ({ ...s })),
    experience: base.experience.map(e => ({ ...e, bullets: [...e.bullets] })),
  };

  if (h.summary && h.summary.trim()) {
    next.summary = h.summary.trim();
  }

  if (h.skills.length > 0) {
    // Classify each approved suggestion into the appropriate category.
    const buckets: Record<string, string[]> = {};
    for (const skill of h.skills) {
      const bucket = classifySkill(skill);
      if (!buckets[bucket]) buckets[bucket] = [];
      buckets[bucket].push(skill);
    }
    // Merge classified skills into the existing skill categories.
    next.skillCategories = next.skillCategories.map(s => {
      const additions = buckets[s.category];
      if (!additions || additions.length === 0) return s;
      const existing = s.items.trim();
      const joined = additions.join(', ');
      return { ...s, items: existing ? `${existing}, ${joined}` : joined };
    });
    // Append any categories not in the default list (shouldn't happen, but safe).
    for (const [cat, items] of Object.entries(buckets)) {
      if (!next.skillCategories.some(s => s.category === cat)) {
        next.skillCategories.push({ category: cat, items: items.join(', ') });
      }
    }
  }

  for (const ex of h.experience) {
    const exp = next.experience[ex.experience_index];
    if (!exp) continue;
    if (ex.bullet_index < 0 || ex.bullet_index >= exp.bullets.length) continue;
    exp.bullets[ex.bullet_index] = ex.suggested;
  }

  return next;
}

// ─── defaults ─────────────────────────────────────────────────────────────────

const EMPTY_BASICS: Basics = { name: '', portfolio: '', github: '', linkedin: '', email: '', phone: '' };

const EMPTY_EDU: EducationItem = {
  institution: '', location: '', degree: '', gpa: '', years: '', coursework: '',
};

const EMPTY_EXP: ExperienceItem = {
  company: '', location: '', title: '', duration: '', bullets: [''],
};

const DEFAULT_SKILLS: SkillCategory[] = [
  { category: 'Languages', items: '' },
  { category: 'Frameworks & Technologies', items: '' },
  { category: 'Cloud & DevOps', items: '' },
  { category: 'Tools & Platforms', items: '' },
  { category: 'Software Engineering Concepts', items: '' },
];

const EMPTY_PROJECT: ProjectItem = { name: '', tags: '', description: '', tech: '', date: '', bullets: [] };

const EMPTY_PUB: PublicationItem = {
  prefix: 'Book', title: '', tags: '', description: '', tech: '', date: '',
};

const EMPTY_AWARD: Award = { name: '', date: '' };

const EMPTY_VOL: VolunteerItem = { org: '', location: '', description: '', duration: '' };

const INITIAL: ResumeData = {
  basics: { ...EMPTY_BASICS },
  summary: '',
  education: [{ ...EMPTY_EDU }],
  skillCategories: DEFAULT_SKILLS.map(s => ({ ...s })),
  experience: [{ ...EMPTY_EXP, bullets: [''] }],
  projects: [{ ...EMPTY_PROJECT }],
  publications: [{ ...EMPTY_PUB }],
  awards: [{ ...EMPTY_AWARD }],
  volunteer: [{ ...EMPTY_VOL }],
};

// ─── style tokens ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition';
const labelCls = 'block text-xs font-medium text-indigo-300 mb-1';
const cardCls = 'rounded-xl border border-white/10 bg-white/5 p-4';
const removeBtnCls = 'text-red-400 hover:text-red-300 text-xs transition-colors';
const addBtnCls =
  'mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-100 transition-colors';

// ─── sub-components ───────────────────────────────────────────────────────────

function CollapsibleSection({
  title, open, onToggle, children,
}: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-xs font-semibold text-white/50 uppercase tracking-widest border-b border-white/10 pb-2 hover:text-white/70 transition-colors"
      >
        <span>{title}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

function Field({
  label, value, onChange, placeholder, fullWidth, textarea, rows,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; fullWidth?: boolean; textarea?: boolean; rows?: number;
}) {
  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <label className={labelCls}>{label}</label>
      {textarea ? (
        <textarea
          className={`${inputCls} resize-none`}
          rows={rows ?? 2}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className={inputCls}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={addBtnCls}>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {label}
    </button>
  );
}

function normalizeResumeData(partial: Partial<ResumeData> | null | undefined): ResumeData {
  const safe = partial ?? ({} as Partial<ResumeData>);
  return {
    basics: { ...EMPTY_BASICS, ...safe.basics },
    summary: safe.summary ?? '',
    education: safe.education?.length ? safe.education : [{ ...EMPTY_EDU }],
    skillCategories: safe.skillCategories?.length ? safe.skillCategories : DEFAULT_SKILLS.map(s => ({ ...s })),
    experience: safe.experience?.length ? safe.experience : [{ ...EMPTY_EXP, bullets: [''] }],
    projects: safe.projects?.length ? safe.projects.map(p => ({ ...EMPTY_PROJECT, ...p })) : [{ ...EMPTY_PROJECT }],
    publications: safe.publications?.length ? safe.publications : [{ ...EMPTY_PUB }],
    awards: safe.awards?.length ? safe.awards : [{ ...EMPTY_AWARD }],
    volunteer: safe.volunteer?.length ? safe.volunteer : [{ ...EMPTY_VOL }],
  };
}

// ── suggestions helpers ────────────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

const SUGGESTIONS_CACHE_PREFIX = 'rb_suggestions_';

function getSuggestionsCacheKey(data: ResumeData): string {
  return SUGGESTIONS_CACHE_PREFIX + simpleHash(JSON.stringify(data));
}

function loadCachedSuggestions(data: ResumeData): ResumeSuggestions | null {
  try {
    const raw = localStorage.getItem(getSuggestionsCacheKey(data));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as ResumeSuggestions;
  } catch {
    return null;
  }
}

function cacheSuggestions(data: ResumeData, s: ResumeSuggestions): void {
  try {
    localStorage.setItem(getSuggestionsCacheKey(data), JSON.stringify(s));
  } catch { /* quota exceeded or localStorage disabled */ }
}

function matchingKeys(data: ResumeData, s: ResumeSuggestions | null): Set<string> {
  const keys = new Set<string>();
  if (!s) return keys;

  if (s.summary && data.summary === s.summary.original) keys.add('summary');

  if (s.experience) {
    for (const es of s.experience) {
      const exp = data.experience[es.exp_index];
      if (!exp) continue;
      for (const b of es.bullets) {
        if (exp.bullets[b.bullet_index] === b.original) {
          keys.add(`exp_${es.exp_index}_b_${b.bullet_index}`);
        }
      }
    }
  }

  if (s.projects) {
    for (const ps of s.projects) {
      const proj = data.projects[ps.proj_index];
      if (!proj) continue;
      if (ps.description && proj.description === ps.description.original) keys.add(`proj_${ps.proj_index}_desc`);
      if (ps.tech && proj.tech === ps.tech.original) keys.add(`proj_${ps.proj_index}_tech`);
    }
  }

  if (s.awards) {
    for (const aw of s.awards) {
      const award = data.awards[aw.award_index];
      if (!award) continue;
      if (aw.name && award.name === aw.name.original) keys.add(`award_${aw.award_index}_name`);
      if (aw.date && award.date === aw.date.original) keys.add(`award_${aw.award_index}_date`);
    }
  }

  if (s.volunteer) {
    for (const vs of s.volunteer) {
      const vol = data.volunteer[vs.vol_index];
      if (!vol) continue;
      if (vol.description === vs.description.original) keys.add(`vol_${vs.vol_index}_desc`);
    }
  }

  return keys;
}

function suggestionCount(s: ResumeSuggestions | null): number {
  if (!s) return 0;
  let n = s.summary ? 1 : 0;
  if (s.experience) for (const es of s.experience) n += es.bullets.length;
  if (s.projects) for (const ps of s.projects) n += (ps.description ? 1 : 0) + (ps.tech ? 1 : 0);
  if (s.awards) for (const aw of s.awards) n += (aw.name ? 1 : 0) + (aw.date ? 1 : 0);
  if (s.volunteer) for (const vs of s.volunteer) n += 1;
  if (s.skills?.reclassifications) n += s.skills.reclassifications.length;
  return n;
}

function SuggestionCard({
  original, suggested, onReplace, onRevert, onDismiss, applied,
}: {
  original: string; suggested: string; onReplace: () => void;
  onRevert: () => void; onDismiss: () => void; applied: boolean;
}) {
  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-amber-300">✨ Suggestion</span>
        <button onClick={onDismiss} className="text-white/30 hover:text-white/60 text-sm leading-none px-1">×</button>
      </div>
      <div className="text-xs text-white/40 mb-1">Original</div>
      <div className="text-xs text-white/60 mb-3 bg-white/5 rounded p-2 whitespace-pre-wrap">{original}</div>
      <div className="text-xs text-emerald-300/80 mb-1">Suggested</div>
      <div className="text-sm text-white/90 mb-3 bg-emerald-500/5 rounded p-2 whitespace-pre-wrap">{suggested}</div>
      <div className="flex items-center gap-2">
        {applied ? (
          <button onClick={onRevert}
            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors">
            Revert
          </button>
        ) : (
          <button onClick={onReplace}
            className="px-3 py-1 rounded-full bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold transition-colors">
            Replace
          </button>
        )}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ResumeBuilderClient() {
  const router = useRouter();
  const [data, setData] = useState<ResumeData>(INITIAL);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const savedResumeIdParam = searchParams?.get('saved_resume_id') ?? null;
  const generatedIdParam = searchParams?.get('generated_id') ?? null;
  const resumeIdParam = savedResumeIdParam || generatedIdParam ? null : (searchParams?.get('resume_id') ?? null);
  const [prefillState, setPrefillState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    resumeIdParam || savedResumeIdParam || generatedIdParam ? 'loading' : 'idle'
  );
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const [reparsing, setReparsing] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState(0);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [design, setDesign] = useState<ResumeDesignSettings>(DEFAULT_DESIGN_SETTINGS);
  const [sections, setSections] = useState<Record<string, boolean>>({
    design: false,
    basics: true,
    summary: true,
    skills: true,
    experience: true,
    projects: true,
    publications: true,
    education: true,
    awards: true,
    volunteer: true,
  });
  const toggleSection = (key: string) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── AI suggestions ───────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<ResumeSuggestions | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [appliedSuggestKeys, setAppliedSuggestKeys] = useState<Set<string>>(new Set());
  const [dismissedSuggestKeys, setDismissedSuggestKeys] = useState<Set<string>>(new Set());

  const stableMatchingKeys = matchingKeys(data, suggestions);
  // A suggestion is visible if: it has been applied (so user can revert), OR
  // its field still matches the original text AND it hasn't been dismissed.
  const isSuggestionVisible = (key: string) =>
    appliedSuggestKeys.has(key) || (stableMatchingKeys.has(key) && !dismissedSuggestKeys.has(key));
  const isSuggestionApplied = (key: string) => appliedSuggestKeys.has(key);

  const handleGenerateSuggestions = useCallback(async () => {
    // Check cache first
    const cached = loadCachedSuggestions(data);
    if (cached && suggestionCount(cached) > 0) {
      setSuggestions(cached);
      setAppliedSuggestKeys(new Set());
      setDismissedSuggestKeys(new Set());
      return;
    }

    setSuggestionsLoading(true);
    setSuggestionsError(null);
    const guestId = typeof window !== 'undefined' ? localStorage.getItem('guest_id') ?? undefined : undefined;
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? undefined : undefined;
    try {
      const result = await generateSuggestions(data, guestId, token ?? undefined);
      setSuggestions(result);
      setAppliedSuggestKeys(new Set());
      setDismissedSuggestKeys(new Set());
      cacheSuggestions(data, result);
    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  }, [data]);

  const handleReplaceAll = useCallback(() => {
    if (!suggestions) return;
    setData(prev => {
      let next = { ...prev };

      // Summary
      if (suggestions.summary) next.summary = suggestions.summary.suggested;

      // Experience bullets
      if (suggestions.experience) {
        const exp = next.experience.map(e => ({ ...e, bullets: [...e.bullets] }));
        for (const es of suggestions.experience) {
          for (const b of es.bullets) {
            exp[es.exp_index].bullets[b.bullet_index] = b.suggested;
          }
        }
        next.experience = exp;
      }

      // Projects
      if (suggestions.projects) {
        const projs = next.projects.map(p => ({ ...p }));
        for (const ps of suggestions.projects) {
          if (ps.description) projs[ps.proj_index].description = ps.description.suggested;
          if (ps.tech) projs[ps.proj_index].tech = ps.tech.suggested;
        }
        next.projects = projs;
      }

      // Awards
      if (suggestions.awards) {
        const awards = next.awards.map(a => ({ ...a }));
        for (const aw of suggestions.awards) {
          if (aw.name) awards[aw.award_index].name = aw.name.suggested;
          if (aw.date) awards[aw.award_index].date = aw.date.suggested;
        }
        next.awards = awards;
      }

      // Volunteer
      if (suggestions.volunteer) {
        const vol = next.volunteer.map(v => ({ ...v }));
        for (const vs of suggestions.volunteer) {
          vol[vs.vol_index].description = vs.description.suggested;
        }
        next.volunteer = vol;
      }

      // Skills reclassifications
      if (suggestions.skills?.reclassifications) {
        next = applySkillReclassifications(next, suggestions.skills.reclassifications);
      }

      return next;
    });

    // Mark all as applied
    const allKeys = new Set<string>();
    if (suggestions.summary) allKeys.add('summary');
    if (suggestions.experience) {
      for (const es of suggestions.experience)
        for (const b of es.bullets) allKeys.add(`exp_${es.exp_index}_b_${b.bullet_index}`);
    }
    if (suggestions.projects) {
      for (const ps of suggestions.projects) {
        if (ps.description) allKeys.add(`proj_${ps.proj_index}_desc`);
        if (ps.tech) allKeys.add(`proj_${ps.proj_index}_tech`);
      }
    }
    if (suggestions.awards) {
      for (const aw of suggestions.awards) {
        if (aw.name) allKeys.add(`award_${aw.award_index}_name`);
        if (aw.date) allKeys.add(`award_${aw.award_index}_date`);
      }
    }
    if (suggestions.volunteer) {
      for (const vs of suggestions.volunteer) allKeys.add(`vol_${vs.vol_index}_desc`);
    }
    setAppliedSuggestKeys(allKeys);
  }, [suggestions]);

  const dismissKey = useCallback((key: string) => {
    setDismissedSuggestKeys(prev => { const n = new Set(prev); n.add(key); return n; });
  }, []);

  const applyKey = useCallback((key: string) => {
    setAppliedSuggestKeys(prev => { const n = new Set(prev); n.add(key); return n; });
  }, []);

  function applySkillReclassifications(d: ResumeData, reclass: Array<{skill: string; from_category: string; to_category: string}>): ResumeData {
    const categories = d.skillCategories.map(s => ({ ...s }));
    for (const r of reclass) {
      // Remove from source category
      for (const cat of categories) {
        if (cat.category === r.from_category) {
          const items = cat.items.split(',').map(s => s.trim()).filter(Boolean);
          const idx = items.findIndex(s => s.toLowerCase() === r.skill.toLowerCase());
          if (idx >= 0) {
            items.splice(idx, 1);
            cat.items = items.join(', ');
          }
        }
      }
      // Add to target category
      for (const cat of categories) {
        if (cat.category === r.to_category) {
          const items = cat.items.split(',').map(s => s.trim()).filter(Boolean);
          if (!items.some(s => s.toLowerCase() === r.skill.toLowerCase())) {
            items.push(r.skill);
            cat.items = items.join(', ');
          }
        }
      }
    }
    return { ...d, skillCategories: categories };
  }

  // ── adjustable split ──────────────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(40); // default 40:60
  const splitRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !splitRef.current?.parentElement) return;
      const rect = splitRef.current.parentElement.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(Math.max(pct, 25), 65));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Load from a saved resume (Edit flow) — takes precedence over resume_id.
  useEffect(() => {
    if (!savedResumeIdParam) return;
    let cancelled = false;
    setPrefillState('loading');
    setPrefillError(null);
    setEditingName(null);
    getSavedResume(savedResumeIdParam)
      .then(res => {
        if (cancelled) return;
        setData(normalizeResumeData(res.resume_data));
        setEditingName(res.name);
        if (res.design) {
          setDesign(res.design);
        }
        setPrefillState('success');
      })
      .catch(err => {
        if (cancelled) return;
        setPrefillError(err instanceof Error ? err.message : 'Could not load saved resume.');
        setPrefillState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [savedResumeIdParam]);

  // Load from a job-generated resume (via matching-jobs flow)
  useEffect(() => {
    if (!generatedIdParam) return;
    let cancelled = false;
    setPrefillState('loading');
    setPrefillError(null);
    setEditingName(null);
    getGeneratedResume(generatedIdParam)
      .then(res => {
        if (cancelled) return;
        const base = parsedToBuilder(res.generated_data);
        setData(base);
        setEditingName(`${res.job_title ?? 'Job'} — ${res.company ?? 'Company'}`);
        setPrefillState('success');
      })
      .catch(err => {
        if (cancelled) return;
        setPrefillError(err instanceof Error ? err.message : 'Could not load generated resume.');
        setPrefillState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [generatedIdParam]);

  useEffect(() => {
    if (!resumeIdParam) return;
    let cancelled = false;
    setPrefillState('loading');
    setPrefillError(null);
    getParsedResume(resumeIdParam)
      .then(res => {
        if (cancelled) return;
        const base = parsedToBuilder(res.parsed_data);
        const handoff = readHandoff(resumeIdParam);
        if (handoff) {
          console.log('[suggestions] applying handoff:', handoff);
          setData(applyHandoff(base, handoff));
          const applied =
            (handoff.summary ? 1 : 0) +
            handoff.skills.length +
            handoff.experience.length;
          console.log('[suggestions] applied count:', applied);
          setAppliedSuggestions(applied);
          // Consume the handoff so a refresh doesn't re-apply on top of edits.
          sessionStorage.removeItem(SUGGESTION_HANDOFF_KEY);
        } else {
          console.log('[suggestions] no handoff to apply');
          setData(base);
        }
        setPrefillState('success');
      })
      .catch(err => {
        if (cancelled) return;
        setPrefillError(err instanceof Error ? err.message : 'Could not prefill from resume.');
        setPrefillState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [resumeIdParam]);

  const handleReparse = useCallback(async () => {
    if (!resumeIdParam || reparsing) return;
    setReparsing(true);
    setPrefillError(null);
    try {
      const res = await reparseResume(resumeIdParam);
      setData(parsedToBuilder(res.parsed_data));
      setAppliedSuggestions(0);
      setPrefillState('success');
    } catch (err) {
      setPrefillError(err instanceof Error ? err.message : 'Re-extract failed.');
      setPrefillState('error');
    } finally {
      setReparsing(false);
    }
  }, [resumeIdParam, reparsing]);

  // ── basics ────────────────────────────────────────────────────────────────
  const setBasics = (field: keyof Basics, v: string) =>
    setData(d => ({ ...d, basics: { ...d.basics, [field]: v } }));

  // ── education ─────────────────────────────────────────────────────────────
  const setEdu = (i: number, field: keyof EducationItem, v: string) =>
    setData(d => {
      const education = [...d.education];
      education[i] = { ...education[i], [field]: v };
      return { ...d, education };
    });
  const addEdu = () => setData(d => ({ ...d, education: [...d.education, { ...EMPTY_EDU }] }));
  const removeEdu = (i: number) =>
    setData(d => ({ ...d, education: d.education.filter((_, idx) => idx !== i) }));

  // ── experience ────────────────────────────────────────────────────────────
  const setExp = (i: number, field: keyof Omit<ExperienceItem, 'bullets'>, v: string) =>
    setData(d => {
      const experience = [...d.experience];
      experience[i] = { ...experience[i], [field]: v };
      return { ...d, experience };
    });
  const setBullet = (ei: number, bi: number, v: string) =>
    setData(d => {
      const experience = [...d.experience];
      const bullets = [...experience[ei].bullets];
      bullets[bi] = v;
      experience[ei] = { ...experience[ei], bullets };
      return { ...d, experience };
    });
  const addBullet = (ei: number) =>
    setData(d => {
      const experience = [...d.experience];
      experience[ei] = { ...experience[ei], bullets: [...experience[ei].bullets, ''] };
      return { ...d, experience };
    });
  const removeBullet = (ei: number, bi: number) =>
    setData(d => {
      const experience = [...d.experience];
      experience[ei] = {
        ...experience[ei],
        bullets: experience[ei].bullets.filter((_, i) => i !== bi),
      };
      return { ...d, experience };
    });
  const addExp = () =>
    setData(d => ({ ...d, experience: [...d.experience, { ...EMPTY_EXP, bullets: [''] }] }));
  const removeExp = (i: number) =>
    setData(d => ({ ...d, experience: d.experience.filter((_, idx) => idx !== i) }));

  // ── skills ────────────────────────────────────────────────────────────────
  const setSkill = (i: number, v: string) =>
    setData(d => {
      const skillCategories = [...d.skillCategories];
      skillCategories[i] = { ...skillCategories[i], items: v };
      return { ...d, skillCategories };
    });

  // ── projects ──────────────────────────────────────────────────────────────
  const setProject = (i: number, field: keyof Omit<ProjectItem, 'bullets'>, v: string) =>
    setData(d => {
      const projects = [...(d.projects ?? [])];
      projects[i] = { ...EMPTY_PROJECT, ...projects[i], [field]: v };
      return { ...d, projects };
    });
  const setProjectBullet = (pi: number, bi: number, v: string) =>
    setData(d => {
      const projects = [...d.projects];
      const bullets = [...projects[pi].bullets];
      bullets[bi] = v;
      projects[pi] = { ...projects[pi], bullets };
      return { ...d, projects };
    });
  const addProjectBullet = (pi: number) =>
    setData(d => {
      const projects = [...d.projects];
      projects[pi] = { ...projects[pi], bullets: [...projects[pi].bullets, ''] };
      return { ...d, projects };
    });
  const removeProjectBullet = (pi: number, bi: number) =>
    setData(d => {
      const projects = [...d.projects];
      projects[pi] = {
        ...projects[pi],
        bullets: projects[pi].bullets.filter((_, i) => i !== bi),
      };
      return { ...d, projects };
    });
  const addProject = () =>
    setData(d => ({ ...d, projects: [...d.projects, { ...EMPTY_PROJECT }] }));
  const removeProject = (i: number) =>
    setData(d => ({ ...d, projects: d.projects.filter((_, idx) => idx !== i) }));

  // ── publications ──────────────────────────────────────────────────────────
  const setPub = (i: number, field: keyof PublicationItem, v: string) =>
    setData(d => {
      const publications = [...d.publications];
      publications[i] = { ...publications[i], [field]: v };
      return { ...d, publications };
    });
  const addPub = () =>
    setData(d => ({ ...d, publications: [...d.publications, { ...EMPTY_PUB }] }));
  const removePub = (i: number) =>
    setData(d => ({ ...d, publications: d.publications.filter((_, idx) => idx !== i) }));

  // ── awards ────────────────────────────────────────────────────────────────
  const setAward = (i: number, field: keyof Award, v: string) =>
    setData(d => {
      const awards = [...d.awards];
      awards[i] = { ...awards[i], [field]: v };
      return { ...d, awards };
    });
  const addAward = () => setData(d => ({ ...d, awards: [...d.awards, { ...EMPTY_AWARD }] }));
  const removeAward = (i: number) =>
    setData(d => ({ ...d, awards: d.awards.filter((_, idx) => idx !== i) }));

  // ── volunteer ─────────────────────────────────────────────────────────────
  const setVol = (i: number, field: keyof VolunteerItem, v: string) =>
    setData(d => {
      const volunteer = [...d.volunteer];
      volunteer[i] = { ...volunteer[i], [field]: v };
      return { ...d, volunteer };
    });
  const addVol = () =>
    setData(d => ({ ...d, volunteer: [...d.volunteer, { ...EMPTY_VOL }] }));
  const removeVol = (i: number) =>
    setData(d => ({ ...d, volunteer: d.volunteer.filter((_, idx) => idx !== i) }));

  // ── print / save PDF (same-page print → no about:blank tab) ──────────────
  // We trigger window.print() on this page. globals.css has the @media print
  // rules that hide everything except #resume-preview and remove browser
  // headers/footers via @page margin:0. The browser's "Save as PDF"
  // destination then produces a clean A4 PDF that matches the live preview.
  const handlePrint = useCallback(() => {
    const previousTitle = document.title;
    // The print header (if the user has it enabled) reads document.title, so
    // pick a clean filename-style title and restore the old one after.
    document.title = (data.basics.name || 'Resume').trim();
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }, [data.basics.name]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900">
      <div className="fixed -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-700/20 blur-[100px] pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />

      <Navbar />

      <div className="relative z-10 flex h-[calc(100vh-64px)] mt-16">

        {/* ── LEFT: editor ──────────────────────────────────────────────── */}
        <div className="overflow-y-auto border-r border-white/10 px-8 py-8" style={{ width: `${leftWidth}%` }}>
          <Link
            href={
              savedResumeIdParam
                ? '/saved-resumes'
                : generatedIdParam
                  ? '/dashboard'
                  : resumeIdParam
                    ? `/resumes/${resumeIdParam}/analyses`
                    : '/dashboard'
            }
            className="inline-flex items-center gap-1.5 text-indigo-200 hover:text-white text-sm mb-4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {savedResumeIdParam
              ? 'Back to saved resumes'
              : generatedIdParam
                ? 'Back to dashboard'
                : resumeIdParam
                  ? 'Back to analysis history'
                  : 'Back to dashboard'}
          </Link>
          <h1 className="text-2xl font-black text-white mb-1">Resume Builder</h1>
          <p className="text-indigo-300 text-sm mb-4">
            Fill in your details — the preview updates live on the right.
          </p>

          {prefillState === 'loading' && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {savedResumeIdParam
                ? 'Loading saved resume…'
                : generatedIdParam
                  ? 'Loading generated resume…'
                  : 'Prefilling from your uploaded resume…'}
            </div>
          )}
          {prefillState === 'success' && generatedIdParam && (
            <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              AI-enhanced resume for {editingName || 'this job'}. Review and edit before saving. Missing skills have been incorporated into the summary and skills list.
            </div>
          )}
          {prefillState === 'success' && savedResumeIdParam && (
            <div className="mb-6 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
              Editing saved resume{editingName ? `: ${editingName}` : ''}. Changes you save will create a new saved resume — your original stays untouched.
            </div>
          )}
          {prefillState === 'success' && !savedResumeIdParam && appliedSuggestions > 0 && (
            <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Applied {appliedSuggestions} approved suggestion{appliedSuggestions === 1 ? '' : 's'} from your ATS analysis. Review the highlighted sections before generating.
            </div>
          )}
          {prefillState === 'success' && !savedResumeIdParam && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              <span>Prefilled from your uploaded resume — review and edit before generating.</span>
              {resumeIdParam && (
                <button
                  onClick={handleReparse}
                  disabled={reparsing}
                  className="px-2.5 py-1 rounded-full bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-semibold transition-colors"
                >
                  {reparsing ? 'Re-extracting…' : 'Re-extract from original PDF'}
                </button>
              )}
            </div>
          )}
          {prefillState === 'error' && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <span>Couldn’t prefill ({prefillError}). Starting from a blank form.</span>
              {resumeIdParam && (
                <button
                  onClick={handleReparse}
                  disabled={reparsing}
                  className="px-2.5 py-1 rounded-full bg-amber-600/80 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-semibold transition-colors"
                >
                  {reparsing ? 'Re-extracting…' : 'Try re-extract'}
                </button>
              )}
            </div>
          )}

          {/* ── AI Suggestions Toolbar ──────────────────────────────────── */}
          <div className="mb-6">
            {!suggestions ? (
              <button
                onClick={handleGenerateSuggestions}
                disabled={suggestionsLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-amber-600/80 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {suggestionsLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating AI suggestions…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    ✨ AI Suggestions
                  </>
                )}
              </button>
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs text-amber-200">
                    {suggestionCount(suggestions)} suggestion{suggestionCount(suggestions) === 1 ? '' : 's'} available
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReplaceAll}
                      className="px-3 py-1 rounded-full bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                    >
                      Apply All
                    </button>
                    <button
                      onClick={handleGenerateSuggestions}
                      disabled={suggestionsLoading}
                      className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                    >
                      {suggestionsLoading ? 'Regenerating…' : 'Regenerate'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {suggestionsError && (
              <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {suggestionsError}
                <button onClick={handleGenerateSuggestions} className="ml-2 underline hover:text-red-100">Retry</button>
              </div>
            )}
          </div>

          {/* DESIGN SETTINGS */}
          <CollapsibleSection title="Design Settings" open={sections.design} onToggle={() => toggleSection('design')}>
            <div className={cardCls}>
              {/* Font Size */}
              <div className="mb-4">
                <label className={labelCls}>Font Size</label>
                <div className="flex gap-1.5">
                  {(['small', 'normal', 'large'] as FontSize[]).map(size => (
                    <button
                      key={size}
                      onClick={() => setDesign(d => ({ ...d, fontSize: size }))}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${design.fontSize === size
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
                        }`}
                    >
                      {size === 'small' ? 'Small' : size === 'normal' ? 'Normal' : 'Large'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Margins */}
              <div className="mb-4">
                <label className={labelCls}>Margins</label>
                <div className="flex gap-1.5">
                  {(['normal', 'tight', 'none'] as MarginSize[]).map(size => (
                    <button
                      key={size}
                      onClick={() => setDesign(d => ({ ...d, marginSize: size }))}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${design.marginSize === size
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
                        }`}
                    >
                      {size === 'normal' ? 'Normal' : size === 'tight' ? 'Tight' : 'Edge to Edge'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family */}
              <div className="mb-4">
                <label className={labelCls}>Font Family</label>
                <div className="flex gap-1.5">
                  {(['texgyre', 'latinmodern', 'roboto', 'times'] as FontFamily[]).map(font => (
                    <button
                      key={font}
                      onClick={() => setDesign(d => ({ ...d, fontFamily: font }))}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${design.fontFamily === font
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
                        }`}
                      style={{ fontFamily: FONT_FAMILY_MAP[font].css }}
                    >
                      {font === 'texgyre' ? 'Heiros' : font === 'latinmodern' ? 'Modern' : font === 'roboto' ? 'Roboto' : 'Times'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bullet Style */}
              <div className="mb-4">
                <label className={labelCls}>Bullet Style</label>
                <div className="flex gap-1.5">
                  {(['dash', 'dot', 'arrow', 'diamond'] as BulletStyle[]).map(style => (
                    <button
                      key={style}
                      onClick={() => setDesign(d => ({ ...d, bulletStyle: style }))}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                        ${design.bulletStyle === style
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
                        }`}
                    >
                      {style === 'dash' ? '–' : style === 'dot' ? '•' : style === 'arrow' ? '→' : '◆'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spacing */}
              <div>
                <label className={labelCls}>Spacing</label>
                <div className="flex gap-1.5">
                  {(['normal', 'compact'] as SpacingMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setDesign(d => ({ ...d, spacing: mode }))}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${design.spacing === mode
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
                        }`}
                    >
                      {mode === 'normal' ? 'Normal' : 'Compact'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* BASICS */}
          <CollapsibleSection title="Basics" open={sections.basics} onToggle={() => toggleSection('basics')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" value={data.basics.name}
                onChange={v => setBasics('name', v)} placeholder="Your Full Name" fullWidth />
              <Field label="Portfolio URL" value={data.basics.portfolio}
                onChange={v => setBasics('portfolio', v)} placeholder="yoursite.com" />
              <Field label="GitHub" value={data.basics.github}
                onChange={v => setBasics('github', v)} placeholder="github.com/yourusername" />
              <Field label="Email" value={data.basics.email}
                onChange={v => setBasics('email', v)} placeholder="you@email.com" />
              <Field label="Phone / Mobile" value={data.basics.phone}
                onChange={v => setBasics('phone', v)} placeholder="+1-XXX-XXX-XXXX" />
              <Field label="LinkedIn URL" value={data.basics.linkedin}
                onChange={v => setBasics('linkedin', v)} placeholder="linkedin.com/in/yourprofile" />
            </div>
          </CollapsibleSection>

          {/* SUMMARY */}
          <CollapsibleSection title="Summary" open={sections.summary} onToggle={() => toggleSection('summary')}>
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              value={data.summary}
              onChange={e => setData(d => ({ ...d, summary: e.target.value }))}
              placeholder="2 to 4 sentences describing your experience and what you bring to the role…"
            />
            {suggestions?.summary && isSuggestionVisible('summary') && (
              <SuggestionCard
                original={suggestions.summary.original}
                suggested={suggestions.summary.suggested}
                applied={isSuggestionApplied('summary')}
                onReplace={() => {
                  setData(d => ({ ...d, summary: suggestions.summary!.suggested }));
                  applyKey('summary');
                }}
                onRevert={() => {
                  setData(d => ({ ...d, summary: suggestions.summary!.original }));
                  setAppliedSuggestKeys(prev => { const n = new Set(prev); n.delete('summary'); return n; });
                }}
                onDismiss={() => dismissKey('summary')}
              />
            )}
          </CollapsibleSection>

          {/* SKILLS SUMMARY */}
          <CollapsibleSection title="Skills Summary" open={sections.skills} onToggle={() => toggleSection('skills')}>
            <div className="space-y-3">
              {data.skillCategories.map((skill, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-white/70 w-24 shrink-0">
                    {skill.category}:
                  </span>
                  <input
                    className={inputCls}
                    value={skill.items}
                    onChange={e => setSkill(i, e.target.value)}
                    placeholder={
                      i === 0 ? 'e.g. Python, Java, SQL, MySQL, JavaScript, TypeScript' :
                      i === 1 ? 'e.g. Flask, Django, React, PySpark, Apache Kafka, MongoDB' :
                      i === 2 ? 'e.g. AWS, Docker, Kubernetes, Git, CI/CD, Linux, Terraform' :
                      i === 3 ? 'e.g. JIRA, VS Code, Postman, IntelliJ, Figma, Swagger' :
                               'e.g. DDD, OOP, RESTful APIs, Design Patterns, System Design, Data Structures'
                    }
                  />
                </div>
              ))}
            </div>
            {/* Skill reclassification suggestions */}
            {suggestions?.skills?.reclassifications && suggestions.skills.reclassifications.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-amber-300">
                    Skill reclassifications ({suggestions.skills.reclassifications.length})
                  </span>
                  <button
                    onClick={() => {
                      setData(d => applySkillReclassifications(d, suggestions.skills!.reclassifications));
                      setDismissedSuggestKeys(prev => {
                        const n = new Set(prev);
                        n.add('skills_reclass');
                        return n;
                      });
                    }}
                    className="px-2.5 py-1 rounded-full bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                  >
                    Apply all
                  </button>
                </div>
                <div className="space-y-1.5">
                  {suggestions.skills.reclassifications.map((r, ri) => (
                    <div key={ri} className="flex items-center gap-2 text-xs text-white/80">
                      <span className="text-amber-300">→</span>
                      Move <span className="text-white font-medium">{r.skill}</span>
                      from <span className="text-white/50">{r.from_category}</span>
                      to <span className="text-emerald-300">{r.to_category}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* EXPERIENCE */}
          <CollapsibleSection title="Experience" open={sections.experience} onToggle={() => toggleSection('experience')}>
            {/* Per-section apply-all for experience */}
            {suggestions?.experience && suggestions.experience.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    setData(d => {
                      const exp = d.experience.map(e => ({ ...e, bullets: [...e.bullets] }));
                      for (const es of suggestions.experience!) {
                        for (const b of es.bullets) {
                          exp[es.exp_index].bullets[b.bullet_index] = b.suggested;
                        }
                      }
                      return { ...d, experience: exp };
                    });
                    const keys = new Set<string>();
                    for (const es of suggestions.experience!)
                      for (const b of es.bullets) keys.add(`exp_${es.exp_index}_b_${b.bullet_index}`);
                    setAppliedSuggestKeys(prev => { const n = new Set(prev); keys.forEach(k => n.add(k)); return n; });
                  }}
                  className="px-2.5 py-1 rounded-full bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                >
                  Apply all experience suggestions
                </button>
              </div>
            )}
            <div className="space-y-4">
              {data.experience.map((exp, i) => {
                // Collect bullet suggestion keys for this position
                const posBulletSuggestKeys: string[] = [];
                if (suggestions?.experience) {
                  const es = suggestions.experience.find(e => e.exp_index === i);
                  if (es) {
                    for (const b of es.bullets) {
                      const key = `exp_${i}_b_${b.bullet_index}`;
                      if (isSuggestionVisible(key)) posBulletSuggestKeys.push(key);
                    }
                  }
                }
                return (
                <div key={i} className={cardCls}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-indigo-300 font-semibold">Position {i + 1}</span>
                    {data.experience.length > 1 && (
                      <button onClick={() => removeExp(i)} className={removeBtnCls}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Field label="Company" value={exp.company}
                      onChange={v => setExp(i, 'company', v)} placeholder="Company Name" />
                    <Field label="Location" value={exp.location}
                      onChange={v => setExp(i, 'location', v)} placeholder="City, Country or Remote" />
                    <Field label="Job Title" value={exp.title}
                      onChange={v => setExp(i, 'title', v)} placeholder="Software Engineer (Full-time)" />
                    <Field label="Duration" value={exp.duration}
                      onChange={v => setExp(i, 'duration', v)} placeholder="Jan 2022 - Present" />
                  </div>
                  <label className={labelCls}>
                    Bullet Points <span className="text-white/30">(use "Title: detail" for bold prefix)</span>
                  </label>
                  <div className="space-y-2">
                    {exp.bullets.map((b, bi) => {
                      const bKey = `exp_${i}_b_${bi}`;
                      const esForBullet = suggestions?.experience
                        ?.find(e => e.exp_index === i)
                        ?.bullets.find(bu => bu.bullet_index === bi);
                      const showSuggestion = esForBullet && isSuggestionVisible(bKey);
                      return (
                      <div key={bi}>
                        <div className="flex gap-2 items-start">
                          <button
                            onClick={() => {
                              if (showSuggestion) {
                                if (isSuggestionApplied(bKey)) {
                                  setAppliedSuggestKeys(prev => { const n = new Set(prev); n.delete(bKey); return n; });
                                } else {
                                  dismissKey(bKey);
                                }
                              }
                            }}
                            className="text-white/40 text-sm mt-2 select-none shrink-0"
                          >
                            {showSuggestion ? (isSuggestionApplied(bKey) ? '✓' : '✧') : '○'}
                          </button>
                          <input
                            className={inputCls}
                            value={b}
                            onChange={e => setBullet(i, bi, e.target.value)}
                            placeholder="Feature Name: Brief description of what you built or improved…"
                          />
                          {exp.bullets.length > 1 && (
                            <button onClick={() => removeBullet(i, bi)}
                              className="shrink-0 text-red-400 hover:text-red-300 text-lg leading-none mt-1.5 px-1">
                              ×
                            </button>
                          )}
                        </div>
                        {showSuggestion && (
                          <SuggestionCard
                            original={esForBullet!.original}
                            suggested={esForBullet!.suggested}
                            applied={isSuggestionApplied(bKey)}
                            onReplace={() => {
                              setBullet(i, bi, esForBullet!.suggested);
                              applyKey(bKey);
                            }}
                            onRevert={() => {
                              setBullet(i, bi, esForBullet!.original);
                              setAppliedSuggestKeys(prev => { const n = new Set(prev); n.delete(bKey); return n; });
                            }}
                            onDismiss={() => dismissKey(bKey)}
                          />
                        )}
                      </div>
                      );
                    })}
                  </div>
                  <AddButton onClick={() => addBullet(i)} label="Add Bullet" />
                </div>
                );
              })}
            </div>
            <AddButton onClick={addExp} label="Add Position" />
          </CollapsibleSection>

          {/* PROJECTS */}
          <CollapsibleSection title="Projects" open={sections.projects} onToggle={() => toggleSection('projects')}>
            {/* Per-section apply-all */}
            {suggestions?.projects && suggestions.projects.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    setData(d => {
                      const projs = d.projects.map(p => ({ ...p }));
                      for (const ps of suggestions.projects!) {
                        if (ps.description) projs[ps.proj_index].description = ps.description.suggested;
                        if (ps.tech) projs[ps.proj_index].tech = ps.tech.suggested;
                      }
                      return { ...d, projects: projs };
                    });
                    const keys = new Set<string>();
                    for (const ps of suggestions.projects!) {
                      if (ps.description) keys.add(`proj_${ps.proj_index}_desc`);
                      if (ps.tech) keys.add(`proj_${ps.proj_index}_tech`);
                    }
                    setAppliedSuggestKeys(prev => { const n = new Set(prev); keys.forEach(k => n.add(k)); return n; });
                  }}
                  className="px-2.5 py-1 rounded-full bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                >
                  Apply all project suggestions
                </button>
              </div>
            )}
            <div className="space-y-4">
              {(data.projects ?? []).map((proj, i) => {
                const psForProj = suggestions?.projects?.find(p => p.proj_index === i);
                const descKey = `proj_${i}_desc`;
                const techKey = `proj_${i}_tech`;
                return (
                <div key={i} className={cardCls}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-indigo-300 font-semibold">Project {i + 1}</span>
                    {(data.projects ?? []).length > 1 && (
                      <button onClick={() => removeProject(i)} className={removeBtnCls}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Project Name" value={proj?.name ?? ''}
                      onChange={v => setProject(i, 'name', v)}
                      placeholder="Your Project Name" fullWidth />
                    <Field label="Tags / Keywords" value={proj?.tags ?? ''}
                      onChange={v => setProject(i, 'tags', v)}
                      placeholder="Machine Learning, Web App, Open Source" fullWidth />
                    <div>
                      <Field label="Description" value={proj?.description ?? ''}
                        onChange={v => setProject(i, 'description', v)}
                        placeholder="Brief description of what the project does and its impact…"
                        fullWidth textarea rows={2} />
                      {psForProj?.description && isSuggestionVisible(descKey) && (
                        <SuggestionCard
                          original={psForProj.description.original}
                          suggested={psForProj.description.suggested}
                          applied={isSuggestionApplied(descKey)}
                          onReplace={() => { setProject(i, 'description', psForProj.description!.suggested); applyKey(descKey); }}
                          onRevert={() => { setProject(i, 'description', psForProj.description!.original); setAppliedSuggestKeys(prev => { const n = new Set(prev); n.delete(descKey); return n; }); }}
                          onDismiss={() => dismissKey(descKey)}
                        />
                      )}
                    </div>
                    <div>
                      <Field label="Tech Stack" value={proj?.tech ?? ''}
                        onChange={v => setProject(i, 'tech', v)}
                        placeholder="Python, React, PostgreSQL, Docker" />
                      {psForProj?.tech && isSuggestionVisible(techKey) && (
                        <SuggestionCard
                          original={psForProj.tech.original}
                          suggested={psForProj.tech.suggested}
                          applied={isSuggestionApplied(techKey)}
                          onReplace={() => { setProject(i, 'tech', psForProj.tech!.suggested); applyKey(techKey); }}
                          onRevert={() => { setProject(i, 'tech', psForProj.tech!.original); setAppliedSuggestKeys(prev => { const n = new Set(prev); n.delete(techKey); return n; }); }}
                          onDismiss={() => dismissKey(techKey)}
                        />
                      )}
                    </div>
                    <Field label="Date" value={proj?.date ?? ''}
                      onChange={v => setProject(i, 'date', v)} placeholder="March 2023" />
                  </div>
                  <label className={`${labelCls} mt-3`}>
                    Bullet Points <span className="text-white/30">(optional, use "Title: detail" for bold prefix)</span>
                  </label>
                  <div className="space-y-2">
                    {proj.bullets.map((b, bi) => (
                      <div key={bi}>
                        <div className="flex gap-2 items-start">
                          <span className="text-white/40 text-sm mt-2 select-none shrink-0">○</span>
                          <input
                            className={inputCls}
                            value={b}
                            onChange={e => setProjectBullet(i, bi, e.target.value)}
                            placeholder="Feature Name: Brief description of what you built or improved…"
                          />
                          {proj.bullets.length > 0 && (
                            <button onClick={() => removeProjectBullet(i, bi)}
                              className="shrink-0 text-red-400 hover:text-red-300 text-lg leading-none mt-1.5 px-1">
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <AddButton onClick={() => addProjectBullet(i)} label="Add Bullet" />
                </div>
                );
              })}
            </div>
            <AddButton onClick={addProject} label="Add Project" />
          </CollapsibleSection>

          {/* PUBLICATIONS */}
          <CollapsibleSection title="Publications" open={sections.publications} onToggle={() => toggleSection('publications')}>
            <div className="space-y-4">
              {data.publications.map((pub, i) => (
                <div key={i} className={cardCls}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-indigo-300 font-semibold">Publication {i + 1}</span>
                    {data.publications.length > 1 && (
                      <button onClick={() => removePub(i)} className={removeBtnCls}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Type (prefix)" value={pub.prefix}
                      onChange={v => setPub(i, 'prefix', v)} placeholder="Book / Paper / Article" />
                    <Field label="Date" value={pub.date}
                      onChange={v => setPub(i, 'date', v)} placeholder="Month Year" />
                    <Field label="Title" value={pub.title}
                      onChange={v => setPub(i, 'title', v)}
                      placeholder="Title of your publication" fullWidth />
                    <Field label="Tags / Keywords" value={pub.tags}
                      onChange={v => setPub(i, 'tags', v)}
                      placeholder="Distributed Systems, Cloud Computing" fullWidth />
                    <Field label="Description" value={pub.description}
                      onChange={v => setPub(i, 'description', v)}
                      placeholder="Brief summary of the publication and its contribution…"
                      fullWidth textarea rows={2} />
                    <Field label="Tech Stack" value={pub.tech}
                      onChange={v => setPub(i, 'tech', v)}
                      placeholder="Python, TensorFlow, Kubernetes" fullWidth />
                  </div>
                </div>
              ))}
            </div>
            <AddButton onClick={addPub} label="Add Publication" />
          </CollapsibleSection>

          {/* EDUCATION */}
          <CollapsibleSection title="Education" open={sections.education} onToggle={() => toggleSection('education')}>
            <div className="space-y-4">
              {data.education.map((edu, i) => (
                <div key={i} className={cardCls}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-indigo-300 font-semibold">Degree {i + 1}</span>
                    {data.education.length > 1 && (
                      <button onClick={() => removeEdu(i)} className={removeBtnCls}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Institution" value={edu.institution}
                      onChange={v => setEdu(i, 'institution', v)}
                      placeholder="University / College Name" />
                    <Field label="Location" value={edu.location}
                      onChange={v => setEdu(i, 'location', v)} placeholder="City, Country" />
                    <Field label="Degree / Program" value={edu.degree}
                      onChange={v => setEdu(i, 'degree', v)}
                      placeholder="Bachelor of Science - Computer Science" fullWidth />
                    <Field label="GPA" value={edu.gpa}
                      onChange={v => setEdu(i, 'gpa', v)} placeholder="3.8" />
                    <Field label="Years" value={edu.years}
                      onChange={v => setEdu(i, 'years', v)} placeholder="Aug 2018 - May 2022" />
                    <Field label="Courses" value={edu.coursework}
                      onChange={v => setEdu(i, 'coursework', v)}
                      placeholder="Data Structures, Algorithms, Operating Systems…" fullWidth />
                  </div>
                </div>
              ))}
            </div>
            <AddButton onClick={addEdu} label="Add Degree" />
          </CollapsibleSection>

          {/* HONORS & AWARDS */}
          <CollapsibleSection title="Honors & Awards" open={sections.awards} onToggle={() => toggleSection('awards')}>
            {/* Per-section apply-all */}
            {suggestions?.awards && suggestions.awards.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    setData(d => {
                      const awards = d.awards.map(a => ({ ...a }));
                      for (const aw of suggestions.awards!) {
                        if (aw.name) awards[aw.award_index].name = aw.name.suggested;
                        if (aw.date) awards[aw.award_index].date = aw.date.suggested;
                      }
                      return { ...d, awards };
                    });
                    const keys = new Set<string>();
                    for (const aw of suggestions.awards!) {
                      if (aw.name) keys.add(`award_${aw.award_index}_name`);
                      if (aw.date) keys.add(`award_${aw.award_index}_date`);
                    }
                    setAppliedSuggestKeys(prev => { const n = new Set(prev); keys.forEach(k => n.add(k)); return n; });
                  }}
                  className="px-2.5 py-1 rounded-full bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                >
                  Apply all award suggestions
                </button>
              </div>
            )}
            <div className="space-y-3">
              {data.awards.map((award, i) => {
                const awForAward = suggestions?.awards?.find(a => a.award_index === i);
                const nameKey = `award_${i}_name`;
                const dateKey = `award_${i}_date`;
                return (
                <div key={i}>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className={labelCls}>Award</label>
                      <input className={inputCls} value={award.name}
                        onChange={e => setAward(i, 'name', e.target.value)}
                        placeholder="Award or recognition title" />
                    </div>
                    <div className="w-36 shrink-0">
                      <label className={labelCls}>Date</label>
                      <input className={inputCls} value={award.date}
                        onChange={e => setAward(i, 'date', e.target.value)}
                        placeholder="Month, Year" />
                    </div>
                    {data.awards.length > 1 && (
                      <button onClick={() => removeAward(i)}
                        className="shrink-0 text-red-400 hover:text-red-300 text-lg leading-none mb-2 px-1">
                        ×
                      </button>
                    )}
                  </div>
                  {awForAward?.name && isSuggestionVisible(nameKey) && (
                    <SuggestionCard
                      original={awForAward.name.original}
                      suggested={awForAward.name.suggested}
                      applied={isSuggestionApplied(nameKey)}
                      onReplace={() => { setAward(i, 'name', awForAward.name!.suggested); applyKey(nameKey); }}
                      onRevert={() => { setAward(i, 'name', awForAward.name!.original); setAppliedSuggestKeys(prev => { const n = new Set(prev); n.delete(nameKey); return n; }); }}
                      onDismiss={() => dismissKey(nameKey)}
                    />
                  )}
                  {awForAward?.date && isSuggestionVisible(dateKey) && (
                    <SuggestionCard
                      original={awForAward.date.original}
                      suggested={awForAward.date.suggested}
                      applied={isSuggestionApplied(dateKey)}
                      onReplace={() => { setAward(i, 'date', awForAward.date!.suggested); applyKey(dateKey); }}
                      onRevert={() => { setAward(i, 'date', awForAward.date!.original); setAppliedSuggestKeys(prev => { const n = new Set(prev); n.delete(dateKey); return n; }); }}
                      onDismiss={() => dismissKey(dateKey)}
                    />
                  )}
                </div>
                );
              })}
            </div>
            <AddButton onClick={addAward} label="Add Award" />
          </CollapsibleSection>

          {/* VOLUNTEER EXPERIENCE */}
          <CollapsibleSection title="Volunteer Experience" open={sections.volunteer} onToggle={() => toggleSection('volunteer')}>
            {/* Per-section apply-all */}
            {suggestions?.volunteer && suggestions.volunteer.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    setData(d => {
                      const vol = d.volunteer.map(v => ({ ...v }));
                      for (const vs of suggestions.volunteer!) {
                        vol[vs.vol_index].description = vs.description.suggested;
                      }
                      return { ...d, volunteer: vol };
                    });
                    const keys = new Set<string>();
                    for (const vs of suggestions.volunteer!) keys.add(`vol_${vs.vol_index}_desc`);
                    setAppliedSuggestKeys(prev => { const n = new Set(prev); keys.forEach(k => n.add(k)); return n; });
                  }}
                  className="px-2.5 py-1 rounded-full bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                >
                  Apply all volunteer suggestions
                </button>
              </div>
            )}
            <div className="space-y-4">
              {data.volunteer.map((vol, i) => {
                const vsForVol = suggestions?.volunteer?.find(v => v.vol_index === i);
                const descKey = `vol_${i}_desc`;
                return (
                <div key={i} className={cardCls}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-indigo-300 font-semibold">Role {i + 1}</span>
                    {data.volunteer.length > 1 && (
                      <button onClick={() => removeVol(i)} className={removeBtnCls}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Organization / Role" value={vol.org}
                      onChange={v => setVol(i, 'org', v)}
                      placeholder="Role at Organization Name" fullWidth />
                    <Field label="Location" value={vol.location}
                      onChange={v => setVol(i, 'location', v)} placeholder="City, Country" />
                    <Field label="Duration" value={vol.duration}
                      onChange={v => setVol(i, 'duration', v)} placeholder="Jan 2020 - Present" />
                    <div>
                      <Field label="Description" value={vol.description}
                        onChange={v => setVol(i, 'description', v)}
                        placeholder="Brief description of your contributions and impact…"
                        fullWidth textarea rows={2} />
                      {vsForVol?.description && isSuggestionVisible(descKey) && (
                        <SuggestionCard
                          original={vsForVol.description.original}
                          suggested={vsForVol.description.suggested}
                          applied={isSuggestionApplied(descKey)}
                          onReplace={() => { setVol(i, 'description', vsForVol.description!.suggested); applyKey(descKey); }}
                          onRevert={() => { setVol(i, 'description', vsForVol.description!.original); setAppliedSuggestKeys(prev => { const n = new Set(prev); n.delete(descKey); return n; }); }}
                          onDismiss={() => dismissKey(descKey)}
                        />
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
            <AddButton onClick={addVol} label="Add Role" />
          </CollapsibleSection>
        </div>

        {/* ── draggable splitter ─────────────────────────────────────────── */}
        <div
          ref={splitRef}
          onMouseDown={onSplitMouseDown}
          className="w-1.5 cursor-col-resize bg-white/10 hover:bg-indigo-500/60 active:bg-indigo-400 transition-colors shrink-0"
        />

        {/* ── RIGHT: live preview ────────────────────────────────────────── */}
        <div className="flex flex-col px-6 py-8" style={{ width: `${100 - leftWidth}%` }}>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-white">Live Preview</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSaveOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 13l4 4L19 7" />
                </svg>
                Save Resume
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Save PDF
              </button>
            </div>
          </div>

          {savedToast && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              <span>Saved! You can find it on the Saved Resumes dashboard.</span>
              <button
                onClick={() => router.push('/saved-resumes')}
                className="px-2.5 py-1 rounded-full bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors"
              >
                View saved resumes →
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto rounded-xl bg-gray-200/10 p-4">
            <div className="w-fit mx-auto">
              <ResumePreview data={data} design={design} />
            </div>
          </div>
        </div>
      </div>

      <SaveResumeModal
        isOpen={saveOpen}
        data={data}
        design={design}
        onClose={() => setSaveOpen(false)}
        onSaved={() => {
          setSaveOpen(false);
          setSavedToast('saved');
          window.setTimeout(() => setSavedToast(null), 8000);
        }}
      />
    </div>
  );
}
