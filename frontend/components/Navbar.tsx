'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from './AuthModal';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'login' | 'register'>('login');

  const openLogin = () => { setModalTab('login'); setModalOpen(true); };
  const openRegister = () => { setModalTab('register'); setModalOpen(true); };

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 bg-indigo-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-white text-lg">AI Career Coach</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-white/70 hover:text-white text-sm transition-colors">How It Works</a>
            <a href="#benefits" className="text-white/70 hover:text-white text-sm transition-colors">Benefits</a>
            <a href="#testimonials" className="text-white/70 hover:text-white text-sm transition-colors">Testimonials</a>
          </div>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-white/80 text-sm max-w-[140px] truncate">{user.name}</span>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={openLogin}
                className="px-4 py-2 rounded-full text-white/70 hover:text-white text-sm font-medium transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={openRegister}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Get Started Free
              </button>
            </div>
          )}
        </div>
      </nav>

      <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} defaultTab={modalTab} />
    </>
  );
}
