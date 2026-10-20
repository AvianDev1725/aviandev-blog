import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ['@aviandev/core'],
  async rewrites() {
    return [{ source: '/media/:path*', destination: `${API_URL}/media/:path*` }];
  },
};

export default nextConfig;