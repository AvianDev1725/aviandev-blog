import { createHash, createHmac } from 'node:crypto';
import { eq, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { postViews, viewVisitors } from '../db/schema.js';

const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch|go-http/i;

export function isBot(userAgent: string) {
  return userAgent.trim() === '' || BOT_PATTERN.test(userAgent);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

function dailySalt(day: string) {
  const secret = process.env.VIEW_SECRET;
  if (!secret) throw new Error('VIEW_SECRET is not set');
  return createHmac('sha256', secret).update(day).digest('hex');
}

export function visitorHash(postId: number, ip: string, userAgent: string, day: string) {
  return createHash('sha256').update(`${dailySalt(day)}|${postId}|${ip}|${userAgent}`).digest('hex');
}

export async function recordView(postId: number, ip: string, userAgent: string) {
  const day = today();
  const firstVisit = await db
    .insert(viewVisitors)
    .values({ hash: visitorHash(postId, ip, userAgent, day), day })
    .onConflictDoNothing()
    .returning({ hash: viewVisitors.hash });

  if (firstVisit.length === 0) return;

  await db
    .insert(postViews)
    .values({ postId, day, views: 1 })
    .onConflictDoUpdate({
      target: [postViews.postId, postViews.day],
      set: { views: sql`${postViews.views} + 1` },
    });

  await db.delete(viewVisitors).where(lt(viewVisitors.day, day));
}

export async function totalViews(postId: number) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${postViews.views}), 0)::int` })
    .from(postViews)
    .where(eq(postViews.postId, postId));
  return row?.total ?? 0;
}