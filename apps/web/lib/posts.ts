import { cacheLife, cacheTag } from 'next/cache';
import type { DocNode } from '@/components/post-content';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const TIMEOUT_MS = 5000;

/**
 * With Cache Components, generateStaticParams must return at least one item.
 * When the API is down during a build, pages get this slug instead. It always
 * shows the 404 page, and real pages are rendered when someone visits them.
 */
export const PLACEHOLDER_SLUG = '__placeholder';

export function staticParams(slugs: string[]) {
  return (slugs.length ? slugs : [PLACEHOLDER_SLUG]).map((slug) => ({ slug }));
}

export type Category = { id: number; name: string; slug: string };

export type CategoryDetail = Category & { description: string };

export type PostSummary = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string | null;
  updatedAt: string;
  categories: Category[];
  noindex: boolean;
  views: number;
  readingMinutes: number;
};

export type Post = PostSummary & {
  content: DocNode;
  authorName: string | null;
  seoTitle: string;
  seoDescription: string;
  shareImage: string;
  published: boolean;
};

/** ok: false means the API couldn't be reached. data: null means it said "not found". */
type ApiResult<T> = { ok: true; data: T | null } | { ok: false };

/** Never throws. */
async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return { ok: true, data: null };
    if (!res.ok) throw new Error(`status ${res.status}`);
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    console.warn(`[blog] API unavailable for ${path}:`, err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

async function fetchPosts(categorySlug: string): Promise<PostSummary[]> {
  'use cache';
  cacheTag('posts', 'categories');

  const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : '';
  const result = await apiGet<PostSummary[]>(`/posts${query}`);
  if (!result.ok) {
    // An empty list from a failed request is only kept briefly.
    cacheLife('minutes');
    return [];
  }
  cacheLife('hours');
  return result.data ?? [];
}

export async function getPosts(categorySlug = ''): Promise<PostSummary[]> {
  return fetchPosts(categorySlug);
}

async function fetchPost(slug: string): Promise<Post | null> {
  'use cache';
  cacheTag(`post:${slug}`, 'categories');

  const result = await apiGet<Post>(`/posts/${encodeURIComponent(slug)}`);
  // If the API is down, show an error rather than a false "not found".
  // A 404 would tell Google the post is gone. Errors are never cached.
  if (!result.ok) throw new Error('Post could not be loaded because the API is unavailable');
  cacheLife('days');
  return result.data;
}

export async function getPost(slug: string): Promise<Post | null> {
  if (slug === PLACEHOLDER_SLUG) return null;
  return fetchPost(slug);
}

export async function getCategories(): Promise<CategoryDetail[]> {
  'use cache';
  cacheTag('categories');

  const result = await apiGet<CategoryDetail[]>('/categories');
  if (!result.ok) {
    cacheLife('minutes');
    return [];
  }
  cacheLife('days');
  return result.data ?? [];
}

export async function getPreviewPost(token: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_URL}/preview/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as Post;
  } catch {
    return null;
  }
}

async function fetchRelatedPosts(slug: string): Promise<PostSummary[]> {
  'use cache';
  cacheTag(`post:${slug}`, 'posts', 'categories');

  const result = await apiGet<PostSummary[]>(`/related/${encodeURIComponent(slug)}`);
  if (!result.ok) {
    cacheLife('minutes');
    return [];
  }
  cacheLife('hours');
  return result.data ?? [];
}

export async function getRelatedPosts(slug: string): Promise<PostSummary[]> {
  return fetchRelatedPosts(slug);
}