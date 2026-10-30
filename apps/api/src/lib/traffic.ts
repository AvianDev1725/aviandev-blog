import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

export type Source = 'organic' | 'social' | 'referral' | 'direct' | 'internal';
export type Device = 'phone' | 'tablet' | 'desktop';

const SEARCH_ENGINES = [
  /(^|\.)google\.[a-z.]+$/,
  /(^|\.)bing\.com$/,
  /(^|\.)duckduckgo\.com$/,
  /(^|\.)search\.yahoo\.com$/,
  /(^|\.)ecosia\.org$/,
  /(^|\.)yandex\.[a-z.]+$/,
  /(^|\.)baidu\.com$/,
  /(^|\.)search\.brave\.com$/,
];

const SOCIAL = [
  /(^|\.)t\.co$/,
  /(^|\.)x\.com$/,
  /(^|\.)twitter\.com$/,
  /(^|\.)linkedin\.com$/,
  /(^|\.)lnkd\.in$/,
  /(^|\.)reddit\.com$/,
  /(^|\.)facebook\.com$/,
  /(^|\.)fb\.me$/,
  /(^|\.)instagram\.com$/,
  /(^|\.)threads\.net$/,
  /(^|\.)youtube\.com$/,
  /(^|\.)news\.ycombinator\.com$/,
  /(^|\.)bsky\.app$/,
];

const SEARCH_NAMES = ['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'brave'];
const SOCIAL_NAMES = ['twitter', 'x', 'linkedin', 'reddit', 'facebook', 'instagram', 'youtube', 'threads', 'bluesky', 'hackernews'];

export function classifySource(input: { landing: boolean; referrer?: string; utmSource?: string }): { source: Source; host: string | null } {
  if (!input.landing) return { source: 'internal', host: null };

  let host: string | null = null;
  if (input.referrer) {
    try {
      host = new URL(input.referrer).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      host = null;
    }
  }
  const tag = input.utmSource?.trim().toLowerCase() || null;
  const name = host ?? tag;
  if (!name) return { source: 'direct', host: null };

  if (SEARCH_ENGINES.some((pattern) => pattern.test(name)) || SEARCH_NAMES.includes(name)) return { source: 'organic', host: name };
  if (SOCIAL.some((pattern) => pattern.test(name)) || SOCIAL_NAMES.includes(name)) return { source: 'social', host: name };
  return { source: 'referral', host: name };
}

export function deviceFrom(userAgent: string): Device {
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) return 'phone';
  return 'desktop';
}

/* ---------- Real visitor IP ---------- */

/**
 * How many of our own servers sit in front of the API.
 * Local: browser → Next → API = 1. Behind a host's load balancer as well: 2.
 */
function trustedHops() {
  const value = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : 1;
}

/** "::ffff:1.2.3.4" → "1.2.3.4"; drops ports and anything that isn't an IP. */
function cleanIp(value: string | undefined) {
  if (!value) return null;
  let ip = value.trim().replace(/^\[|\](:\d+)?$/g, '');
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.split(':')[0]!;
  return /^[0-9a-f.:]{2,45}$/i.test(ip) ? ip.toLowerCase() : null;
}

/** The address that connected to this API directly (null in tests). */
function peerAddress(c: Context) {
  try {
    return cleanIp(getConnInfo(c).remote.address);
  } catch {
    return null;
  }
}

/**
 * The visitor's real IP. Each server appends the address it received the request
 * from to X-Forwarded-For, so only the last entries (added by our own servers) can
 * be trusted. Entries further left came from the visitor and may be made up.
 */
export function clientIp(c: Context) {
  const forwarded = (c.req.header('x-forwarded-for') ?? '')
    .split(',')
    .map(cleanIp)
    .filter((ip): ip is string => ip !== null);

  const peer = peerAddress(c);
  const chain = peer ? [...forwarded, peer] : forwarded;
  const skip = peer ? trustedHops() : Math.max(trustedHops() - 1, 0);

  return chain[chain.length - 1 - skip] ?? chain[0] ?? 'unknown';
}