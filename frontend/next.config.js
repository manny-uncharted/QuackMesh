const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Use the JS MDX compiler via @mdx-js/loader instead of the Rust implementation
    mdxRs: false,
  },
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  async rewrites() {
    // Proxy frontend /api requests to the backend API during development
    const raw = process.env.NEXT_PUBLIC_API_BASE_URL || ''
    const target = /^https?:\/\//.test(raw) ? raw : 'http://localhost:8000/api'
    const serverBase = target.endsWith('/api') ? target.slice(0, -4) : target
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${target}/:path*`,
        },
        // Health endpoints used by ConnectionProvider
        {
          source: '/healthz',
          destination: `${serverBase}/healthz`,
        },
        {
          source: '/readyz',
          destination: `${serverBase}/readyz`,
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
};

module.exports = withMDX(nextConfig);