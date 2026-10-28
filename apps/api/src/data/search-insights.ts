import { and, count, desc, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dismissedSearches, posts, postSections, searchEvents } from '../db/schema.js';

export const KEEP_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SearchProgress = 0 | 50 | 100;

export function normalizeQuery(query: string) {
  return query
    .toLowerCase()
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export async function recordSearch(event: {
  clientId?: string;
  query: string;
  resultCount: number;
  topic?: string;
  openedUrl?: string;
  progress?: SearchProgress;
}) {
  const query = normalizeQuery(event.query);
  if (query.length < 2) return;

  const values = {
    clientId: event.clientId ?? null,
    query,
    resultCount: event.resultCount,
    topic: event.topic || null,
    openedUrl: event.openedUrl || null,
    progress: event.openedUrl ? 100 : (event.progress ?? 0),
  };

  if (!event.clientId) {
    await db.insert(searchEvents).values(values);
    return;
  }

  await db
    .insert(searchEvents)
    .values(values)
    .onConflictDoUpdate({
      target: searchEvents.clientId,
      set: {
        resultCount: event.resultCount,
        openedUrl: sql`coalesce(excluded.opened_url, ${searchEvents.openedUrl})`,
        progress: sql`greatest(excluded.progress, ${searchEvents.progress})`,
      },
    });
}

export async function deleteOldSearches() {
  await db.delete(searchEvents).where(lt(searchEvents.createdAt, new Date(Date.now() - KEEP_DAYS * DAY_MS)));
}

export async function dismissSearch(query: string, userId: number) {
  await db
    .insert(dismissedSearches)
    .values({ query: normalizeQuery(query), dismissedBy: userId })
    .onConflictDoUpdate({ target: dismissedSearches.query, set: { dismissedAt: new Date(), dismissedBy: userId } });
}

async function resolveSections(urls: string[]) {
  const parsed = urls.map((url) => {
    const [path, anchor = ''] = url.split('#');
    return { url, slug: path.replace(/^\/posts\//, ''), anchor };
  });
  const slugs = [...new Set(parsed.map((item) => item.slug))];
  if (slugs.length === 0) return new Map<string, { postTitle: string; heading: string }>();

  const postRows = await db.select({ id: posts.id, slug: posts.slug, title: posts.title }).from(posts).where(inArray(posts.slug, slugs));
  const sectionRows = postRows.length
    ? await db
        .select({ postId: postSections.postId, anchor: postSections.anchor, heading: postSections.heading })
        .from(postSections)
        .where(inArray(postSections.postId, postRows.map((row) => row.id)))
    : [];

  const result = new Map<string, { postTitle: string; heading: string }>();
  for (const item of parsed) {
    const post = postRows.find((row) => row.slug === item.slug);
    if (!post) continue;
    const section = sectionRows.find((row) => row.postId === post.id && row.anchor === item.anchor);
    result.set(item.url, { postTitle: post.title, heading: section?.heading ?? '' });
  }
  return result;
}

export async function getSearchInsights(days: number) {
  await deleteOldSearches();
  const since = new Date(Date.now() - days * DAY_MS);
  const inRange = gte(searchEvents.createdAt, since);

  const searches = count();
  const lastSearched = sql<Date>`max(${searchEvents.createdAt})`;
  const openedPercent = sql<number>`round(100.0 * count(*) filter (where ${searchEvents.progress} = 100) / count(*))::int`;
  const averageResults = sql<number>`round(avg(${searchEvents.resultCount}))::int`;
  const engagement = sql<number>`coalesce(round(avg(${searchEvents.progress})), 0)::int`;
  const day = sql<string>`to_char(date_trunc('day', ${searchEvents.createdAt}), 'YYYY-MM-DD')`;

  const [[totals], perDayRows, ideas, top, unclicked, openedRows] = await Promise.all([
    db
      .select({
        searches,
        withResults: sql<number>`count(*) filter (where ${searchEvents.resultCount} > 0)::int`,
        reachedResultsPage: sql<number>`count(*) filter (where ${searchEvents.progress} >= 50)::int`,
        opened: sql<number>`count(*) filter (where ${searchEvents.progress} = 100)::int`,
        engagement,
      })
      .from(searchEvents)
      .where(inRange),

    db.select({ day, searches }).from(searchEvents).where(inRange).groupBy(day).orderBy(day),

    db
      .select({ query: searchEvents.query, searches, lastSearched })
      .from(searchEvents)
      .leftJoin(dismissedSearches, eq(dismissedSearches.query, searchEvents.query))
      .where(inRange)
      .groupBy(searchEvents.query, dismissedSearches.dismissedAt)
      .having(
        sql`max(${searchEvents.resultCount}) = 0 and (${dismissedSearches.dismissedAt} is null or max(${searchEvents.createdAt}) > ${dismissedSearches.dismissedAt})`,
      )
      .orderBy(desc(searches), desc(lastSearched))
      .limit(20),

    db
      .select({ query: searchEvents.query, searches, averageResults, openedPercent, engagement })
      .from(searchEvents)
      .where(inRange)
      .groupBy(searchEvents.query)
      .orderBy(desc(searches))
      .limit(20),

    db
      .select({ query: searchEvents.query, searches, averageResults, openedPercent, engagement })
      .from(searchEvents)
      .where(inRange)
      .groupBy(searchEvents.query)
      .having(sql`count(*) >= 3 and avg(${searchEvents.resultCount}) > 0 and ${openedPercent} < 20`)
      .orderBy(desc(searches))
      .limit(20),

    db
      .select({ url: searchEvents.openedUrl, visits: count() })
      .from(searchEvents)
      .where(and(inRange, isNotNull(searchEvents.openedUrl)))
      .groupBy(searchEvents.openedUrl)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  const byDay = new Map(perDayRows.map((row) => [row.day, row.searches]));
  const perDay = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.now() - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10);
    return { day: date, searches: byDay.get(date) ?? 0 };
  });

  const urls = openedRows.map((row) => row.url).filter((url): url is string => Boolean(url));
  const names = await resolveSections(urls);
  const sections = openedRows.flatMap((row) => {
    if (!row.url) return [];
    const name = names.get(row.url);
    return name ? [{ url: row.url, visits: row.visits, ...name }] : [];
  });

  return { days, totals, perDay, ideas, top, unclicked, sections };
}