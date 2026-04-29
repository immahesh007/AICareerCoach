const benefits = [
  {
    icon: '🎯',
    title: 'ATS Optimization',
    description:
      'Beat automated screening systems with keywords and formatting that pass ATS filters every time.',
  },
  {
    icon: '🔗',
    title: 'Smart Job Matching',
    description:
      "AI matches your skills and experience to thousands of live job postings for a precise fit.",
  },
  {
    icon: '📊',
    title: 'Skill Gap Analysis',
    description:
      'Pinpoint exactly which skills to add for your target role with prioritized learning paths.',
  },
  {
    icon: '⚡',
    title: 'Instant Feedback',
    description:
      'Get actionable suggestions on content, tone, and structure within seconds of uploading.',
  },
  {
    icon: '📈',
    title: 'Industry Insights',
    description:
      'Stay ahead with real-time salary benchmarks and in-demand skill trends for your field.',
  },
  {
    icon: '🎤',
    title: 'Interview Prep',
    description:
      'Practice with AI-generated questions tailored to your resume and target job description.',
  },
];

export default function Benefits() {
  return (
    <section id="benefits" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-indigo-600 font-semibold text-sm uppercase tracking-widest">
            Why Choose Us
          </span>
          <h2 className="mt-3 text-4xl font-bold text-gray-900">
            Everything you need to land the job
          </h2>
          <p className="mt-4 text-gray-500 text-lg max-w-xl mx-auto">
            A complete AI-powered toolkit that transforms how you approach your job search.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="p-6 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-violet-50 hover:border-indigo-100 transition-all duration-300"
            >
              <div className="text-3xl mb-4">{b.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{b.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{b.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
