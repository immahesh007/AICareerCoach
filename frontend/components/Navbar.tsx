import Link from 'next/link';

export default function Navbar() {
  return (
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

        <a
          href="#upload"
          className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Get Started Free
        </a>
      </div>
    </nav>
  );
}
