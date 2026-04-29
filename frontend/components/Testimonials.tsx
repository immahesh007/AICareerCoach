const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Software Engineer at Google',
    avatar: 'SC',
    gradient: 'from-indigo-500 to-violet-500',
    quote:
      "I was applying for months with no callbacks. After using AI Career Coach, I got 3 interview calls in the first week. The ATS optimization alone was a game-changer.",
  },
  {
    name: 'Marcus Williams',
    role: 'Senior Marketing Manager',
    avatar: 'MW',
    gradient: 'from-violet-500 to-purple-500',
    quote:
      "The skill gap analysis showed me exactly what was missing from my resume for Director-level roles. Got promoted within 4 months of following the recommendations.",
  },
  {
    name: 'Priya Patel',
    role: 'Recent CS Graduate',
    avatar: 'PP',
    gradient: 'from-blue-500 to-indigo-500',
    quote:
      "As a new grad with no connections, this tool was my secret weapon. The job matching feature found roles I wouldn't have thought to look for. Landed my dream job!",
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section
      id="testimonials"
      className="py-24 bg-gradient-to-br from-indigo-950 to-indigo-900 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.15),transparent_60%)]" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-indigo-400 font-semibold text-sm uppercase tracking-widest">
            Success Stories
          </span>
          <h2 className="mt-3 text-4xl font-bold text-white">
            Trusted by thousands of job seekers
          </h2>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Stars />
            <span className="text-indigo-200 text-sm">4.9 / 5 from 2,400+ reviews</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-colors"
            >
              <Stars />
              <p className="mt-4 text-white/80 leading-relaxed text-sm">"{t.quote}"</p>
              <div className="mt-6 flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white text-sm font-bold shrink-0`}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-indigo-300 text-xs">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
