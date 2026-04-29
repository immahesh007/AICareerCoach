'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { validateFile } from '@/utils/fileValidation';
import { uploadResume } from '@/services/uploadService';

type Phase = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

export default function UploadArea() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [uploadedName, setUploadedName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(async (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      setStatusMsg(validation.error);
      setPhase('error');
      return;
    }
    setUploadedName(file.name);
    setPhase('uploading');
    setProgress(0);
    try {
      const result = await uploadResume(file, setProgress);
      setStatusMsg(result.message);
      setPhase('success');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setPhase('error');
    }
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) process(file);
      else setPhase('idle');
    },
    [process]
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setPhase('dragging');
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) process(file);
  };

  const reset = () => {
    setPhase('idle');
    setProgress(0);
    setStatusMsg('');
    setUploadedName('');
    if (inputRef.current) inputRef.current.value = '';
  };

  if (phase === 'uploading') {
    return (
      <Card border="border-indigo-400/50">
        <Spinner />
        <p className="text-white font-semibold text-lg">Uploading {uploadedName}</p>
        <p className="text-indigo-200 text-sm">{progress}% complete</p>
        <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-400 to-violet-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </Card>
    );
  }

  if (phase === 'success') {
    return (
      <Card border="border-emerald-400/50">
        <IconBox color="bg-emerald-500/20">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </IconBox>
        <p className="text-white font-semibold text-lg">Upload Successful!</p>
        <p className="text-indigo-200 text-sm">{statusMsg}</p>
        <button
          onClick={reset}
          className="mt-2 px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors"
        >
          Upload Another Resume
        </button>
      </Card>
    );
  }

  if (phase === 'error') {
    return (
      <Card border="border-red-400/50">
        <IconBox color="bg-red-500/20">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </IconBox>
        <p className="text-white font-semibold text-lg">Upload Failed</p>
        <p className="text-indigo-200 text-sm">{statusMsg}</p>
        <button
          onClick={reset}
          className="mt-2 px-6 py-2.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors"
        >
          Try Again
        </button>
      </Card>
    );
  }

  return (
    <div
      id="upload"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() => setPhase('idle')}
      onClick={() => inputRef.current?.click()}
      className={`relative w-full rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 ${
        phase === 'dragging'
          ? 'border-violet-400 bg-white/20 scale-[1.01]'
          : 'border-white/30 bg-white/10 hover:border-indigo-400 hover:bg-white/15'
      }`}
    >
      <input ref={inputRef} type="file" accept=".pdf,.docx" onChange={onInputChange} className="hidden" />
      <div className="flex flex-col items-center gap-4">
        <IconBox color={phase === 'dragging' ? 'bg-violet-500/30' : 'bg-white/10'}>
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </IconBox>
        <div>
          <p className="text-white font-semibold text-lg">
            {phase === 'dragging' ? 'Release to upload' : 'Drag & drop your resume here'}
          </p>
          <p className="text-indigo-200 text-sm mt-1">
            or{' '}
            <span className="text-indigo-300 font-semibold underline underline-offset-2">
              browse files
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-medium border border-white/20">PDF</span>
          <span className="text-white/40 text-xs">•</span>
          <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-medium border border-white/20">DOCX</span>
          <span className="text-white/40 text-xs">•</span>
          <span className="text-white/50 text-xs">Max 10 MB</span>
        </div>
      </div>
    </div>
  );
}

function Card({ border, children }: { border: string; children: React.ReactNode }) {
  return (
    <div className={`w-full rounded-2xl border-2 ${border} bg-white/10 backdrop-blur-sm p-10 flex flex-col items-center gap-3 text-center`}>
      {children}
    </div>
  );
}

function IconBox({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center transition-colors`}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <IconBox color="bg-indigo-500/20">
      <svg className="w-8 h-8 text-indigo-300 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </IconBox>
  );
}
