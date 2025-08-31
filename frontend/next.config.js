const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/,
  options: {
    // Use the MDX React provider at runtime
    providerImportSource: '@mdx-js/react',
  },
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
};

module.exports = withMDX(nextConfig);