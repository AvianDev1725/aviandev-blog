import type { Context } from 'hono';

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

export function clientIp(c: Context) {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
}