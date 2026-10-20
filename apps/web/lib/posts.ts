import { cacheLife, cacheTag } from 'next/cache';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

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
};

export type Post = PostSummary & {
  content: { type: 'doc'; content?: unknown[] };
  authorName: string | null;
};

async function apiGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API request failed: ${res.status} ${path}`);
  return res.json();
}

async function fetchPosts(categorySlug: string) {
  'use cache';
  cacheLife('days');
  cacheTag('posts', 'categories');

  const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : '';
  return (await apiGet<PostSummary[]>(`/posts${query}`)) ?? [];
}

export async function getPosts(categorySlug = ''): Promise<PostSummary[]> {
  try {
    return await fetchPosts(categorySlug);
  } catch (err) {
    console.error('[blog] could not load posts:', err);
    return [];
  }
}

export async function getPost(slug: string): Promise<Post | null> {
  'use cache';
  cacheLife('days');
  cacheTag(`post:${slug}`, 'categories');

  return apiGet<Post>(`/posts/${encodeURIComponent(slug)}`);
}

export async function getCategories(): Promise<CategoryDetail[]> {
  'use cache';
  cacheLife('days');
  cacheTag('categories');

  return (await apiGet<CategoryDetail[]>('/categories')) ?? [];
}