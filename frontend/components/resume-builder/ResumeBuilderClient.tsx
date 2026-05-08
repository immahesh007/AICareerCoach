'use client';

import { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { generatePDF } from '@/services/resumeBuilderService';
import type { Basics, EducationItem, ExperienceItem, ResumeData } from '@/types/resume';

const EMPTY_BASICS: Basics = { name: '', email: '', phone: '', linkedin: '', summary: '' };
const EMPTY_EXP: ExperienceItem = { title: '', company: '', duration: '', description: '' };
const EMPTY_EDU: EducationItem = { year: '', degree: '', institution: '' };

const INITIAL_DATA: ResumeData = {
  basics: { ...EMPTY_BASICS },
  skills: [''],
  experience: [{ ...EMPTY_EXP }],
  education: [{ ...EMPTY_EDU }],
  certifications: [''],
};

// ─── shared input classes ────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition';
const labelCls = 'block text-xs font-medium text-indigo-300 mb-1';
const sectionCls = 'mb-8';
const sectionTitleCls = 'text-sm font-semibold text-white/70 uppercase tracking-widest mb-4 border-b border-white/10 pb-2';

export default function ResumeBuilderClient() {
  const { user, token } = useAuth();

  // Resolve user_id client-side (localStorage only available on client)
  const userIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    userIdRef.current = user?.id ?? localStorage.getItem('guest_id') ?? undefined;
  }, [user]);

  const [data, setData] = useState<ResumeData>(INITIAL_DATA);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── basics ──────────────────────────────────────────────────────────────────
  const setBasics = (field: keyof Basics, value: string) =>
    setData((d) => ({ ...d, basics: { ...d.basics, [field]: value } }));

  // ── skills ──────────────────────────────────────────────────────────────────
  const setSkill = (i: number, v: string) =>
    setData((d) => {
      const skills = [...d.skills];
      skills[i] = v;
      return { ...d, skills };
    });
  const addSkill = () => setData((d) => ({ ...d, skills: [...d.skills, ''] }));
  const removeSkill = (i: number) =>
    setData((d) => ({ ...d, skills: d.skills.filter((_, idx) => idx !== i) }));

  // ── experience ──────────────────────────────────────────────────────────────
  const setExp = (i: number, field: keyof ExperienceItem, v: string) =>
    setData((d) => {
      const experience = [...d.experience];
      experience[i] = { ...experience[i], [field]: v };
      return { ...d, experience };
    });
  const addExp = () => setData((d) => ({ ...d, experience: [...d.experience, { ...EMPTY_EXP }] }));
  const removeExp = (i: number) =>
    setData((d) => ({ ...d, experience: d.experience.filter((_, idx) => idx !== i) }));

  // ── education ───────────────────────────────────────────────────────────────
  const setEdu = (i: number, field: keyof EducationItem, v: string) =>
    setData((d) => {
      const education = [...d.education];
      education[i] = { ...education[i], [field]: v };
      return { ...d, education };
    });
  const addEdu = () => setData((d) => ({ ...d, education: [...d.education, { ...EMPTY_EDU }] }));
  const removeEdu = (i: number) =>
    setData((d) => ({ ...d, education: d.education.filter((_, idx) => idx !== i) }));

  // ── certifications ──────────────────────────────────────────────────────────
  const setCert = (i: number, v: string) =>
    setData((d) => {
      const certifications = [...d.certifications];
      certifications[i] = v;
      return { ...d, certifications };
    });
  const addCert = () => setData((d) => ({ ...d, certifications: [...d.certifications, ''] }));
  const removeCert = (i: number) =>
    setData((d) => ({ ...d, certifications: d.certifications.filter((_, idx) => idx !== i) }));

  // ── PDF generation ──────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generatePDF(data, userIdRef.current, token ?? undefined);
      setPdfUrl(result.pdf_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900">
      {/* decorative blurs */}
      <div className="fixed -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-700/20 blur-[100px] pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />

      <Navbar />

      <div className="relative z-10 flex h-[calc(100vh-64px)] mt-16">
        {/* ── LEFT PANE: editor ─────────────────────────────────────────────── */}
        <div className="w-1/2 overflow-y-auto border-r border-white/10 px-8 py-8">
          <h1 className="text-2xl font-black text-white mb-1">Resume Builder</h1>
          <p className="text-indigo-300 text-sm mb-8">
            Edit your details on the left, then hit <span className="text-white font-medium">Refresh Preview</span> to generate your PDF.
          </p>

          {/* BASICS */}
          <section className={sectionCls}>
            <p className={sectionTitleCls}>Basics</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['name', 'Full Name'],
                  ['email', 'Email'],
                  ['phone', 'Phone'],
                  ['linkedin', 'LinkedIn URL'],
                ] as [keyof Basics, string][]
              ).map(([field, placeholder]) => (
                <div key={field}>
                  <label className={labelCls}>{placeholder}</label>
                  <input
                    className={inputCls}
                    value={data.basics[field]}
                    onChange={(e) => setBasics(field, e.target.value)}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className={labelCls}>Summary</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={data.basics.summary}
                onChange={(e) => setBasics('summary', e.target.value)}
                placeholder="Brief professional summary..."
              />
            </div>
          </section>

          {/* SKILLS */}
          <section className={sectionCls}>
            <p className={sectionTitleCls}>Skills</p>
            <div className="space-y-2">
              {data.skills.map((skill, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputCls}
                    value={skill}
                    onChange={(e) => setSkill(i, e.target.value)}
                    placeholder="e.g. Backend: Python, FastAPI, PostgreSQL"
                  />
                  {data.skills.length > 1 && (
                    <button
                      onClick={() => removeSkill(i)}
                      className="shrink-0 text-red-400 hover:text-red-300 text-lg leading-none px-1"
                      aria-label="Remove skill"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <AddButton onClick={addSkill} label="Add Skill Category" />
          </section>

          {/* EXPERIENCE */}
          <section className={sectionCls}>
            <p className={sectionTitleCls}>Experience</p>
            <div className="space-y-5">
              {data.experience.map((exp, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-indigo-300 font-semibold">Position {i + 1}</span>
                    {data.experience.length > 1 && (
                      <button
                        onClick={() => removeExp(i)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ['title', 'Job Title'],
                        ['company', 'Company'],
                        ['duration', 'Duration (e.g. Jan 2022 – Present)'],
                      ] as [keyof ExperienceItem, string][]
                    ).map(([field, placeholder]) => (
                      <div key={field} className={field === 'duration' ? 'col-span-2' : ''}>
                        <label className={labelCls}>{placeholder}</label>
                        <input
                          className={inputCls}
                          value={exp[field]}
                          onChange={(e) => setExp(i, field, e.target.value)}
                          placeholder={placeholder}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label className={labelCls}>Description</label>
                    <textarea
                      className={`${inputCls} resize-none`}
                      rows={3}
                      value={exp.description}
                      onChange={(e) => setExp(i, 'description', e.target.value)}
                      placeholder="Key responsibilities and achievements..."
                    />
                  </div>
                </div>
              ))}
            </div>
            <AddButton onClick={addExp} label="Add Position" />
          </section>

          {/* EDUCATION */}
          <section className={sectionCls}>
            <p className={sectionTitleCls}>Education</p>
            <div className="space-y-5">
              {data.education.map((edu, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-indigo-300 font-semibold">Degree {i + 1}</span>
                    {data.education.length > 1 && (
                      <button
                        onClick={() => removeEdu(i)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        ['year', 'Year'],
                        ['degree', 'Degree'],
                        ['institution', 'Institution'],
                      ] as [keyof EducationItem, string][]
                    ).map(([field, placeholder]) => (
                      <div key={field}>
                        <label className={labelCls}>{placeholder}</label>
                        <input
                          className={inputCls}
                          value={edu[field]}
                          onChange={(e) => setEdu(i, field, e.target.value)}
                          placeholder={placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <AddButton onClick={addEdu} label="Add Degree" />
          </section>

          {/* CERTIFICATIONS */}
          <section className={sectionCls}>
            <p className={sectionTitleCls}>Certifications & Honours</p>
            <div className="space-y-2">
              {data.certifications.map((cert, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputCls}
                    value={cert}
                    onChange={(e) => setCert(i, e.target.value)}
                    placeholder="e.g. AWS Certified Solutions Architect"
                  />
                  {data.certifications.length > 1 && (
                    <button
                      onClick={() => removeCert(i)}
                      className="shrink-0 text-red-400 hover:text-red-300 text-lg leading-none px-1"
                      aria-label="Remove certification"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <AddButton onClick={addCert} label="Add Certification" />
          </section>
        </div>

        {/* ── RIGHT PANE: preview ────────────────────────────────────────────── */}
        <div className="w-1/2 flex flex-col px-8 py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">PDF Preview</h2>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Preview
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex-1 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="Resume PDF Preview"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-indigo-200 text-sm">
                  Fill in your details and click <span className="text-white font-medium">Refresh Preview</span> to generate your PDF.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-100 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {label}
    </button>
  );
}
