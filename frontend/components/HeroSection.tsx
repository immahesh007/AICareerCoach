import UploadArea from './UploadArea';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-indigo-950 via-[#1e1060] to-indigo-900 flex flex-col items-center justify-center overflow-hidden pt-24 pb-20">
      {/* Background orbs */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-700/20 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-indigo-200 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          Powered by Advanced AI
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
          Transform Your Resume.{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            Land Your Dream Job.
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-indigo-200 text-lg md:text-xl leading-relaxed mb-12 max-w-2xl mx-auto">
          Upload your resume and let our AI coach analyze it, match you with ideal positions, and deliver personalized feedback to make you stand out.
        </p>

        {/* Upload component */}
        <UploadArea />

        {/* Trust indicators */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-white/50 text-sm">
          {['Free to get started', 'No credit card required', 'Results in seconds'].map((label) => (
            <span key={label} className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
