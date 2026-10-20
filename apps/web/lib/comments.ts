import { cacheLife, cacheTag } from 'next/cache';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export type CommentAuthor =
  | { kind: 'guest'; avatar: string | null }
  | { kind: 'reader'; userId: number; name: string; firstName: string | null; lastName: string | null; isStaff: boolean };

export type PublicComment = {
  id: number;
  parentId: number | null;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  body: string;
  author: CommentAuthor | null;
};

export type CommentData = { count: number; comments: PublicComment[] };

async function fetchComments(slug: string): Promise<CommentData> {
  'use cache';
  cacheLife('days');
  cacheTag(`post:${slug}`);

  const res = await fetch(`${API_URL}/comments?post=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`Could not load comments: ${res.status}`);
  return res.json();
}

export async function getComments(slug: string): Promise<CommentData> {
  try {
    return await fetchComments(slug);
  } catch (err) {
    console.error('[blog] could not load comments:', err);
    return { count: 0, comments: [] };
  }
}