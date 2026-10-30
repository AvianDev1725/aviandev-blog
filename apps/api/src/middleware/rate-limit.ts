import { createMiddleware } from 'hono/factory';
import { clientIp } from '../lib/traffic.js';

type Entry = { count: number; resetAt: number };

const MAX_TRACKED = 10_000;

/**
 * Limits each visitor (by real IP) to `max` requests per `windowMs` on this route.
 * Kept in memory, which is fine for a single API server.
 */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, Entry>();
  let nextSweep = Date.now() + windowMs;

  function sweep(now: number) {
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    nextSweep = now + windowMs;
  }

  return createMiddleware(async (c, next) => {
    if (process.env.NODE_ENV === 'test') return next();

    const now = Date.now();
    if (now >= nextSweep || hits.size > MAX_TRACKED) sweep(now);

    const key = clientIp(c);
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else if (++entry.count > max) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ error: 'Too many requests. Try again later.' }, 429);
    }

    await next();
  });
}