'use client';

import { useState } from 'react';
import { analyzeATS } from '@/services/ats';

interface KnowATSButtonProps {
  fileId: string | null;
}

export default function KnowATSButton({ fileId }: KnowATSButtonProps) {
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isUploaded = fileId !== null;
  const charCount = jdText.length;
  const overLimit = charCount > 5000;
  const canSubmit = isUploaded && jdText.trim().length > 0 && !overLimit && !loading;

  async function handleClick() {
    if (!canSubmit || !fileId) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const result = await analyzeATS(fileId, jdText);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="relative flex-1">
        <textarea
          value={jdText}
          onChange={(e) => {
            setJdText(e.target.value);
            setError(null);
            setSuccess(null);
          }}
          disabled={!isUploaded || loading}
          maxLength={5100}
          placeholder={
            isUploaded
              ? 'Paste the job description here…'
              : 'Upload your resume first, then paste a job description here.'
          }
          className={`absolute inset-0 rounded-xl px-4 pb-7 pt-3 text-sm bg-white/10 backdrop-blur-sm border text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 transition-colors ${
            overLimit
              ? 'border-red-400/60 focus:ring-red-400/40'
              : 'border-white/20 focus:ring-indigo-400/40'
          } ${!isUploaded || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <span
          className={`absolute bottom-3 right-3 text-xs tabular-nums z-10 ${
            overLimit ? 'text-red-400' : 'text-white/40'
          }`}
        >
          {charCount} / 5000
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-xs text-emerald-400">{success}</p>
      )}

      <div className="relative inline-flex group self-center">
        {!isUploaded && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 text-white/90 text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
            Upload resume to know your ATS.
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/15" />
          </div>
        )}
        <button
          onClick={handleClick}
          disabled={!canSubmit}
          className={`px-8 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold transition-all duration-200 inline-flex items-center gap-2 ${
            canSubmit
              ? 'hover:opacity-90 hover:scale-[1.02] cursor-pointer shadow-lg shadow-indigo-500/30'
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          {loading && (
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          )}
          {loading ? 'Analyzing…' : 'Know ATS'}
        </button>
      </div>
    </div>
  );
}
