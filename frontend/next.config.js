/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow long-running LLM requests (default 60s is too low for Ollama)
  experimental: {
    proxyTimeout: 180_000, // 3 minutes, in ms
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
