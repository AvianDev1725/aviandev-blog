import { cacheLife, cacheTag } from 'next/cache';
import { contentUrl, mergeAll, type Fallback, type Fragments } from '@aviandev/core/content';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const TIMEOUT_MS = 5000;

/**
 * Fetches CMS text. Never throws: if the API is down or slow, it returns null
 * and the page uses its built-in text. That empty result is cached only
 * briefly, so your CMS text comes back within a minute of the API returning.
 */
async function fetchFragments(keys: string[]): Promise<Fragments | null> {
  'use cache';
  for (const key of keys) cacheTag(`content:${key}`);

  try {
    const res = await fetch(contentUrl(API_URL, keys), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const fragments = (await res.json()) as Fragments;
    cacheLife('hours');
    return fragments;
  } catch (err) {
    cacheLife('minutes');
    console.warn(
      `[cms] API unavailable, using built-in text for ${keys.join(', ')}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function getManyByCMS<R extends Record<string, Fallback>>(fallbacks: R): Promise<R> {
  const keys = Object.keys(fallbacks).sort();
  const fragments = await fetchFragments(keys);
  try {
    return mergeAll(fallbacks, fragments ?? {});
  } catch (err) {
    console.warn('[cms] bad CMS data, using built-in text:', err);
    return fallbacks;
  }
}

export async function getContentByCMS<T extends Fallback>(key: string, fallback: T): Promise<T> {
  const result = await getManyByCMS({ [key]: fallback });
  return result[key] as T;
}