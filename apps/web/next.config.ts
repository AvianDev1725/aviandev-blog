import { networkInterfaces } from 'node:os';
import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const isProduction = process.env.NODE_ENV === 'production';

// This Mac's Wi-Fi / network addresses, so phones on the same network can use the dev server.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((item) => item && item.family === 'IPv4' && !item.internal)
  .map((item) => item!.address);

/*
 * Content Security Policy: which sources the page may load from.
 * Next's static pages include small inline scripts (and our theme script), so
 * inline scripts are allowed; everything else is locked to this site.
 * Only in production: the dev server needs looser rules for hot reload.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProduction
    ? [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        // Browsers only obey this over HTTPS, so it does nothing on localhost.
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ]
    : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    localPatterns: [{ pathname: '/media/**' }],
  },
  transpilePackages: ['@aviandev/core'],
  allowedDevOrigins: lanAddresses,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      { source: '/media/:path*', destination: `${API_URL}/media/:path*` },
      { source: '/api/:path*', destination: `${API_URL}/:path*` },
    ];
  },
};

export default nextConfig;