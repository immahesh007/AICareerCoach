'use client';

import { useEffect, useState } from 'react';
import { saveResume } from '@/services/savedResumesService';
import type { ResumeData, ResumeDesignSettings } from '@/types/resume';

interface Props {
  isOpen: boolean;
  data: ResumeData;
  design: ResumeDesignSettings;
  onClose: () => void;
  onSaved: (savedId: string) => void;
}

export default function SaveResumeModal({ isOpen, data, design, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Pre-fill with the candidate name + today, so the user just hits Save in the common case.
      const today = new Date().toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      const base = data.basics.name?.trim() || 'My Resume';
      setName(`${base} — ${today}`);
      setCompany('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, data.basics.name]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await saveResume(name.trim(), company.trim() || null, data, design);
      onSaved(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save resume.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-indigo-950/95 shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Save Resume</h2>
            <p className="text-xs text-indigo-200 mt-1">Give it a name so you can find it later.</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="text-white/60 hover:text-white disabled:opacity-40 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-indigo-300 mb-1">
              Resume Name <span className="text-red-300">*</span>
            </label>
            <input
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Backend Engineer — Stripe"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-indigo-300 mb-1">
              Company <span className="text-white/40">(optional)</span>
            </label>
            <input
              maxLength={120}
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Stripe, Google, Acme Inc."
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white/80 text-xs font-semibold border border-white/15 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors inline-flex items-center gap-2"
            >
              {submitting && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {submitting ? 'Saving…' : 'Save Resume'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
