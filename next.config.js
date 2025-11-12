/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/apps/pravesh',
  assetPrefix: '/apps/pravesh/',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;