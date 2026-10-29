import { networkInterfaces } from 'node:os';
import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// This Mac's Wi-Fi / network addresses, so phones on the same network can use the dev server.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((item) => item && item.family === 'IPv4' && !item.internal)
  .map((item) => item!.address);

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    localPatterns: [{ pathname: '/media/**' }],
  },
  transpilePackages: ['@aviandev/core'],
  allowedDevOrigins: lanAddresses,
  async rewrites() {
    return [
      { source: '/media/:path*', destination: `${API_URL}/media/:path*` },
      { source: '/api/:path*', destination: `${API_URL}/:path*` },
    ];
  },
};

export default nextConfig;