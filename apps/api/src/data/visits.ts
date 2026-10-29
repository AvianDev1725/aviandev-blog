import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pageVisits, posts } from '../db/schema.js';
import type { Device, Source } from '../lib/traffic.js';

export const VISIT_KEEP_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function recordVisit(visit: {
  id: string;
  path: string;
  visitor: string;
  landing: boolean;
  returning: boolean;
  source: Source;
  referrerHost: string | null;
  device: Device;
  signedIn: boolean;
}) {
  const slug = /^\/posts\/([a-z0-9-]+)$/.exec(visit.path)?.[1];
  const [post] = slug
    ? await db
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.slug, slug), eq(posts.published, true)))
    : [];

  await db
    .insert(pageVisits)
    .values({ ...visit, postId: post?.id ?? null })
    .onConflictDoNothing({ target: pageVisits.id });
}

export async function saveReadDepth(id: string, depth: number) {
  await db
    .update(pageVisits)
    .set({ readDepth: sql`greatest(${pageVisits.readDepth}, ${depth})` })
    .where(and(eq(pageVisits.id, id), gte(pageVisits.createdAt, new Date(Date.now() - DAY_MS))));
}

export async function deleteOldVisits() {
  await db.delete(pageVisits).where(lt(pageVisits.createdAt, new Date(Date.now() - VISIT_KEEP_DAYS * DAY_MS)));
}