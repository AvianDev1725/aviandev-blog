import { createHmac } from 'node:crypto';
import { and, count, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { askEvents, assistantSettings, comments, posts, postSections, postViews } from '../db/schema.js';
import { PROVIDER_IDS, type AiSettings, type AnswerLength, type ProviderId } from '../lib/ai/providers.js';
import type { AskSource } from '../lib/ask-prompt.js';
import { normalizeQuery } from './search-insights.js';
import { searchPosts, visiblePosts, type SearchScope } from './search.js';

export type AssistantConfig = AiSettings & {
  enabled: boolean;
  adminEnabled: boolean;
  dailyLimit: number;
  perReaderLimit: number;
};

export const ASSISTANT_DEFAULTS: AssistantConfig = {
  enabled: false,
  adminEnabled: false,
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  baseUrl: '',
  dailyLimit: 800,
  perReaderLimit: 20,
  answerLength: 'medium',
  creativity: 2,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_MS = process.env.NODE_ENV === 'test' ? 0 : 30_000;
let cache: { value: AssistantConfig; at: number } | null = null;

export async function getAssistantSettings(): Promise<AssistantConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const [row] = await db.select().from(assistantSettings).where(eq(assistantSettings.id, 1));
  const value: AssistantConfig = row
    ? {
      enabled: row.enabled,
      adminEnabled: row.adminEnabled,
      provider: PROVIDER_IDS.includes(row.provider as ProviderId) ? (row.provider as ProviderId) : ASSISTANT_DEFAULTS.provider,
      model: row.model,
      baseUrl: row.baseUrl,
      dailyLimit: row.dailyLimit,
      perReaderLimit: row.perReaderLimit,
      answerLength: (['short', 'medium', 'long'].includes(row.answerLength) ? row.answerLength : 'medium') as AnswerLength,
      creativity: row.creativity,
    }
    : ASSISTANT_DEFAULTS;

  cache = { value, at: Date.now() };
  return value;
}

export async function saveAssistantSettings(value: AssistantConfig, userId: number) {
  await db
    .insert(assistantSettings)
    .values({ id: 1, ...value, updatedBy: userId })
    .onConflictDoUpdate({ target: assistantSettings.id, set: { ...value, updatedBy: userId, updatedAt: new Date() } });
  cache = null;
}

export function askVisitor(ip: string, userAgent: string) {
  const day = new Date().toISOString().slice(0, 10);
  return createHmac('sha256', process.env.VIEW_SECRET ?? 'aviandev-dev')
    .update(`${day}|${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 32);
}

function startOfToday() {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export async function asksToday(visitor: string) {
  const [row] = await db
    .select({
      total: count(),
      mine: sql<number>`count(*) filter (where ${askEvents.visitor} = ${visitor})::int`,
    })
    .from(askEvents)
    .where(and(gte(askEvents.createdAt, startOfToday()), inArray(askEvents.status, ['answered', 'not_found'])));
  return { total: row?.total ?? 0, mine: row?.mine ?? 0 };
}

export async function logAsk(event: {
  id: string;
  question: string;
  visitor: string;
  status: 'answered' | 'not_found' | 'error';
  sourceCount: number;
  provider: string;
  model: string;
  audience?: 'reader' | 'staff';
  citedUrls?: string[];
}) {
  await db.insert(askEvents).values({
    ...event,
    audience: event.audience ?? 'reader',
    citedUrls: event.citedUrls ?? [],
    question: normalizeQuery(event.question),
  });
}

export async function saveFeedback(id: string, helpful: boolean) {
  const rows = await db.update(askEvents).set({ helpful }).where(eq(askEvents.id, id)).returning({ id: askEvents.id });
  return rows.length > 0;
}

const MAX_SOURCES = 5;
const MAX_SOURCE_CHARS = 1800;

export async function findSources(query: string, scope: SearchScope = {}): Promise<AskSource[]> {
  const { results } = await searchPosts(query, { limit: 8, ...scope });
  const wanted = results.map((result) => {
    const [path, anchor = ''] = result.url.split('#');
    return { url: result.url, slug: path.replace(/^\/posts\//, ''), anchor };
  });
  if (wanted.length === 0) return [];

  const rows = await db
    .select({
      postId: posts.id,
      slug: posts.slug,
      title: posts.title,
      published: posts.published,
      anchor: postSections.anchor,
      heading: postSections.heading,
      content: postSections.content,
    })
    .from(postSections)
    .innerJoin(posts, eq(posts.id, postSections.postId))
    .where(and(visiblePosts(scope), inArray(posts.slug, [...new Set(wanted.map((item) => item.slug))])));

  const sources: AskSource[] = [];
  for (const item of wanted) {
    const row = rows.find((candidate) => candidate.slug === item.slug && candidate.anchor === item.anchor);
    if (!row || sources.some((source) => source.url === item.url)) continue;
    sources.push({
      n: sources.length + 1,
      url: item.url,
      postId: row.postId,
      published: row.published,
      postTitle: row.title,
      heading: row.heading,
      content: row.content.slice(0, MAX_SOURCE_CHARS),
    });
    if (sources.length === MAX_SOURCES) break;
  }
  return sources;
}

export async function adminOverview(scope: SearchScope) {
  const visible = visiblePosts(scope);
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
  const views = sql<number>`coalesce(sum(${postViews.views}), 0)::int`;
  const ownPostsOnly = scope.authorId !== undefined ? eq(posts.authorId, scope.authorId) : undefined;

  const [[counts], topViewed, drafts, [waiting]] = await Promise.all([
    db
      .select({
        published: sql<number>`count(*) filter (where ${posts.published})::int`,
        drafts: sql<number>`count(*) filter (where not ${posts.published})::int`,
      })
      .from(posts)
      .where(visible),
    db
      .select({ title: posts.title, views })
      .from(postViews)
      .innerJoin(posts, eq(posts.id, postViews.postId))
      .where(and(visible, gte(postViews.day, since)))
      .groupBy(posts.id, posts.title)
      .orderBy(desc(views))
      .limit(5),
    db
      .select({ title: posts.title, updatedAt: posts.updatedAt })
      .from(posts)
      .where(and(visible, eq(posts.published, false)))
      .orderBy(desc(posts.updatedAt))
      .limit(5),
    db
      .select({ count: count() })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .where(and(eq(comments.status, 'pending'), isNull(comments.deletedAt), ownPostsOnly)),
  ]);

  const list = <T>(rows: T[], format: (row: T) => string, empty: string) => (rows.length ? rows.map(format).join(', ') : empty);

  return [
    `Blog overview on ${new Date().toISOString().slice(0, 10)}:`,
    `- Published posts: ${counts?.published ?? 0}. Drafts: ${counts?.drafts ?? 0}.`,
    `- Most viewed in the last 30 days: ${list(topViewed, (row) => `"${row.title}" (${row.views} views)`, 'no views yet')}.`,
    `- Latest drafts: ${list(drafts, (row) => `"${row.title}" (updated ${row.updatedAt.toISOString().slice(0, 10)})`, 'none')}.`,
    `- Comments waiting for approval: ${waiting?.count ?? 0}.`,
  ].join('\n');
}