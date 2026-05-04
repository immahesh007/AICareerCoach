'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { loginUser, registerUser } from '@/services/authService';

type Tab = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: Tab;
}

export default function AuthModal({ isOpen, onClose, defaultTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);
      setName('');
      setEmail('');
      setPassword('');
      setError('');
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultTab]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!isOpen) return null;

  const guestId = typeof window !== 'undefined' ? (localStorage.getItem('guest_id') ?? undefined) : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = tab === 'login'
        ? await loginUser(email.trim(), password, guestId)
        : await registerUser(name.trim(), email.trim(), password, guestId);
      login(result.user, result.token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t: Tab) => { setTab(t); setError(''); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tab === 'login' ? 'Sign in' : 'Create account'}
        className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header band */}
        <div className="bg-gradient-to-r from-indigo-950 to-indigo-900 px-8 pt-7 pb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg">AI Career Coach</span>
          </div>
          <p className="text-indigo-200 text-sm mt-2">
            {tab === 'login' ? 'Welcome back — sign in to your account' : 'Create a free account to save your results'}
          </p>
        </div>

        {/* Tab row */}
        <div className="flex bg-stone-100 border-b border-amber-200">
          {(['login', 'register'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'text-emerald-700 bg-white border-b-2 border-emerald-600'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              {t === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-stone-50 px-8 py-6 flex flex-col gap-4">
          {tab === 'register' && (
            <Field label="Full Name">
              <input
                ref={firstInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jane Smith"
                className={inputCls}
              />
            </Field>
          )}

          <Field label="Email Address">
            <input
              ref={tab === 'login' ? firstInputRef : undefined}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="jane@example.com"
              autoComplete={tab === 'login' ? 'username' : 'email'}
              className={inputCls}
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder={tab === 'register' ? 'Minimum 8 characters' : '••••••••'}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              className={inputCls}
            />
          </Field>

          {error && (
            <p role="alert" className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading
              ? 'Please wait…'
              : tab === 'login'
              ? 'Sign In'
              : 'Create Account'}
          </button>

          <p className="text-center text-stone-500 text-xs">
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
              className="text-emerald-700 font-semibold hover:underline"
            >
              {tab === 'login' ? 'Create one free' : 'Sign in'}
            </button>
          </p>
        </form>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-shadow';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-stone-700 text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}
