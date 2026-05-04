'use client';

import { useEffect } from 'react';

interface Props {
  isOpen: boolean;
  jdText: string | null;
  jdTitle: string | null;
  onClose: () => void;
}

export default function ViewJDModal({ isOpen, jdText, jdTitle, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl rounded-2xl bg-indigo-950 border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-lg">Job Description</h2>
            {jdTitle && (
              <p className="text-indigo-200/70 text-sm mt-0.5 truncate">{jdTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-2xl leading-none shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex-1">
          {jdText ? (
            <pre className="text-indigo-100 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {jdText}
            </pre>
          ) : (
            <p className="text-white/50 text-sm italic">
              JD not available — this analysis was run before JD storage was enabled.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
