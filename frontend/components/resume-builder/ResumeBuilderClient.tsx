'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ResumePreview from './ResumePreview';
import { getParsedResume, reparseResume } from '@/services/dashboardService';
import { parsedToBuilder } from '@/utils/parsedToBuilder';
import {
  SUGGESTION_HANDOFF_KEY,
  type ApprovedSuggestionsHandoff,
} from './SuggestionReview';
import type {
  Award,
  Basics,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  PublicationItem,
  ResumeData,
  SkillCategory,
  VolunteerItem,
} from '@/types/resume';

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
    // Append approved skill additions to the first existing category that has
    // any items; if none has content, fall back to the first category.
    const targetIdx = next.skillCategories.findIndex(s => s.items.trim().length > 0);
    const idx = targetIdx >= 0 ? targetIdx : 0;
    if (next.skillCategories[idx]) {
      const existing = next.skillCategories[idx].items.trim();
      const additions = h.skills.join(', ');
      next.skillCategories[idx] = {
        ...next.skillCategories[idx],
        items: existing ? `${existing}, ${additions}` : additions,
      };
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

const EMPTY_BASICS: Basics = { name: '', portfolio: '', github: '', email: '', phone: '' };

const EMPTY_EDU: EducationItem = {
  institution: '', location: '', degree: '', gpa: '', years: '', coursework: '',
};

const EMPTY_EXP: ExperienceItem = {
  company: '', location: '', title: '', duration: '', bullets: [''],
};

const DEFAULT_SKILLS: SkillCategory[] = [
  { category: 'Languages', items: '' },
  { category: 'Frameworks', items: '' },
  { category: 'Tools', items: '' },
  { category: 'Platforms', items: '' },
  { category: 'Soft Skills', items: '' },
];

const EMPTY_PROJECT: ProjectItem = { name: '', tags: '', description: '', tech: '', date: '' };

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
const sectionTitleCls =
  'text-xs font-semibold text-white/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-2';
const cardCls = 'rounded-xl border border-white/10 bg-white/5 p-4';
const removeBtnCls = 'text-red-400 hover:text-red-300 text-xs transition-colors';
const addBtnCls =
  'mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-100 transition-colors';

// ─── sub-components ───────────────────────────────────────────────────────────

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

// ─── main component ───────────────────────────────────────────────────────────

export default function ResumeBuilderClient() {
  const [data, setData] = useState<ResumeData>(INITIAL);
  const searchParams = useSearchParams();
  const resumeIdParam = searchParams?.get('resume_id') ?? null;
  const [prefillState, setPrefillState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    resumeIdParam ? 'loading' : 'idle'
  );
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const [reparsing, setReparsing] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState(0);

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
  const setProject = (i: number, field: keyof ProjectItem, v: string) =>
    setData(d => {
      const projects = [...d.projects];
      projects[i] = { ...projects[i], [field]: v };
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

  // ── print ─────────────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const el = document.getElementById('resume-preview');
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
      <title>${data.basics.name || 'Resume'}</title>
      <meta charset="utf-8">
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'TeX Gyre Heros','Helvetica Neue',Helvetica,Arial,sans-serif;}
        @page{margin:0;size:letter;}
      </style>
    </head><body>${el.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }, [data.basics.name]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900">
      <div className="fixed -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-700/20 blur-[100px] pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />

      <Navbar />

      <div className="relative z-10 flex h-[calc(100vh-64px)] mt-16">

        {/* ── LEFT: editor ──────────────────────────────────────────────── */}
        <div className="w-1/2 overflow-y-auto border-r border-white/10 px-8 py-8">
          <Link
            href={resumeIdParam ? `/resumes/${resumeIdParam}/analyses` : '/dashboard'}
            className="inline-flex items-center gap-1.5 text-indigo-200 hover:text-white text-sm mb-4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {resumeIdParam ? 'Back to analysis history' : 'Back to dashboard'}
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
              Prefilling from your uploaded resume…
            </div>
          )}
          {prefillState === 'success' && appliedSuggestions > 0 && (
            <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Applied {appliedSuggestions} approved suggestion{appliedSuggestions === 1 ? '' : 's'} from your ATS analysis. Review the highlighted sections before generating.
            </div>
          )}
          {prefillState === 'success' && (
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

          {/* BASICS */}
          <section className="mb-8">
            <p className={sectionTitleCls}>Basics</p>
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
            </div>
          </section>

          {/* SUMMARY */}
          <section className="mb-8">
            <p className={sectionTitleCls}>Summary</p>
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              value={data.summary}
              onChange={e => setData(d => ({ ...d, summary: e.target.value }))}
              placeholder="2 to 4 sentences describing your experience and what you bring to the role…"
            />
          </section>

          {/* SKILLS SUMMARY */}
          <section className="mb-8">
            <p className={sectionTitleCls}>Skills Summary</p>
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
                      i === 0 ? 'e.g. Python, Java, C++, JavaScript, SQL' :
                      i === 1 ? 'e.g. React, Node.js, Django, Spring Boot' :
                      i === 2 ? 'e.g. Git, Docker, Kubernetes, PostgreSQL' :
                      i === 3 ? 'e.g. Linux, AWS, GCP, Azure' :
                               'e.g. Leadership, Communication, Time Management'
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          {/* EXPERIENCE */}
          <section className="mb-8">
            <p className={sectionTitleCls}>Experience</p>
            <div className="space-y-4">
              {data.experience.map((exp, i) => (
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
                    {exp.bullets.map((b, bi) => (
                      <div key={bi} className="flex gap-2 items-start">
                        <span className="text-white/40 text-sm mt-2 select-none">○</span>
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
                    ))}
                  </div>
                  <AddButton onClick={() => addBullet(i)} label="Add Bullet" />
                </div>
              ))}
            </div>
            <AddButton onClick={addExp} label="Add Position" />
          </section>

          {/* PROJECTS */}
          <section className="mb-8">
            <p className={sectionTitleCls}>Projects</p>
            <div className="space-y-4">
              {data.projects.map((proj, i) => (
                <div key={i} className={cardCls}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-indigo-300 font-semibold">Project {i + 1}</span>
                    {data.projects.length > 1 && (
                      <button onClick={() => removeProject(i)} className={removeBtnCls}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Project Name" value={proj.name}
                      onChange={v => setProject(i, 'name', v)}
                      placeholder="Your Project Name" fullWidth />
                    <Field label="Tags / Keywords" value={proj.tags}
                      onChange={v => setProject(i, 'tags', v)}
                      placeholder="Machine Learning, Web App, Open Source" fullWidth />
                    <Field label="Description" value={proj.description}
                      onChange={v => setProject(i, 'description', v)}
                      placeholder="Brief description of what the project does and its impact…"
                      fullWidth textarea rows={2} />
                    <Field label="Tech Stack" value={proj.tech}
                      onChange={v => setProject(i, 'tech', v)}
                      placeholder="Python, React, PostgreSQL, Docker" />
                    <Field label="Date" value={proj.date}
                      onChange={v => setProject(i, 'date', v)} placeholder="March 2023" />
                  </div>
                </div>
              ))}
            </div>
            <AddButton onClick={addProject} label="Add Project" />
          </section>

          {/* PUBLICATIONS */}
          <section className="mb-8">
            <p className={sectionTitleCls}>Publications</p>
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
          </section>

          {/* EDUCATION */}
          <section className="mb-8">
            <p className={sectionTitleCls}>Education</p>
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
          </section>

          {/* HONORS & AWARDS */}
          <section className="mb-8">
            <p className={sectionTitleCls}>Honors & Awards</p>
            <div className="space-y-2">
              {data.awards.map((award, i) => (
                <div key={i} className="flex gap-2 items-end">
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
              ))}
            </div>
            <AddButton onClick={addAward} label="Add Award" />
          </section>

          {/* VOLUNTEER EXPERIENCE */}
          <section className="mb-8">
            <p className={sectionTitleCls}>Volunteer Experience</p>
            <div className="space-y-4">
              {data.volunteer.map((vol, i) => (
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
                    <Field label="Description" value={vol.description}
                      onChange={v => setVol(i, 'description', v)}
                      placeholder="Brief description of your contributions and impact…"
                      fullWidth textarea rows={2} />
                  </div>
                </div>
              ))}
            </div>
            <AddButton onClick={addVol} label="Add Role" />
          </section>
        </div>

        {/* ── RIGHT: live preview ────────────────────────────────────────── */}
        <div className="w-1/2 flex flex-col px-6 py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Live Preview</h2>
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

          <div className="flex-1 overflow-auto rounded-xl bg-gray-200/10 p-4">
            <div className="bg-white shadow-xl rounded">
              <ResumePreview data={data} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
