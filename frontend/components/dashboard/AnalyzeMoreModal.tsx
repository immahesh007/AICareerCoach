'use client';

import { useEffect, useState } from 'react';
import { triggerNewAnalysis } from '@/services/dashboardService';

interface Props {
  isOpen: boolean;
  resumeId: string;
  resumeLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_JD = 5000;

export default function AnalyzeMoreModal({
  isOpen,
  resumeId,
  resumeLabel,
  onClose,
  onSuccess,
}: Props) {
  const [jdTitle, setJdTitle] = useState('');
  const [jdText, setJdText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setJdTitle('');
      setJdText('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (jdText.trim().length === 0) {
      setError('Please paste a job description.');
      return;
    }
    if (jdText.length > MAX_JD) {
      setError(`Job description must be under ${MAX_JD.toLocaleString()} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      await triggerNewAnalysis(resumeId, jdText, jdTitle);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8 bg-black/60 backdrop-blur-sm text-left" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0"
        onClick={() => !submitting && onClose()}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl rounded-2xl bg-indigo-950 border border-white/15 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="px-6 py-4 border-b border-white/10 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Analyze against a new JD</h2>
            <p className="text-indigo-200/70 text-xs mt-0.5 truncate max-w-[380px]">{resumeLabel}</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-white/50 hover:text-white text-2xl leading-none disabled:opacity-30"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-white/80 text-sm font-medium mb-1.5">
              Company name <span className="text-white/40 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={jdTitle}
              onChange={(e) => setJdTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Stripe — Senior PM"
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-400 disabled:opacity-50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-white/80 text-sm font-medium">Job description</label>
              <span className={`text-xs ${jdText.length > MAX_JD ? 'text-red-400' : 'text-white/40'}`}>
                {jdText.length.toLocaleString()} / {MAX_JD.toLocaleString()}
              </span>
            </div>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={10}
              placeholder="Paste the full job description here…"
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-indigo-400 disabled:opacity-50 resize-y"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {submitting && (
            <div className="flex items-center gap-2 text-indigo-200 text-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running analysis — this can take 5–10 seconds…
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-full text-white/70 hover:text-white text-sm font-medium disabled:opacity-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || jdText.trim().length === 0}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {submitting ? 'Analyzing…' : 'Run Analysis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
