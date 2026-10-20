import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    localPatterns: [{ pathname: '/media/**' }],
  },
  transpilePackages: ['@aviandev/core'],
  allowedDevOrigins: ['192.168.1.4'],
  async rewrites() {
    return [{ source: '/media/:path*', destination: `${API_URL}/media/:path*` }, { source: '/api/:path*', destination: `${process.env.API_URL}/:path*` },];
  },
};

export default nextConfig;