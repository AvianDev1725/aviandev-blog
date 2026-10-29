import { and, count, countDistinct, desc, eq, gte, inArray, isNotNull, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '../db/index.js';
import { askEvents, categories, comments, pageVisits, postCategories, posts, users } from '../db/schema.js';
import { deleteOldVisits } from './visits.js';

const DAY_MS = 24 * 60 * 60 * 1000;

type DayRow = { day: string; value: number };
export type Metric = { values: number[]; previous: number };

/** The last `days` days (UTC), plus the same-length period before them. */
export function windowFor(days: number) {
  const keys = Array.from({ length: days }, (_, index) =>
    new Date(Date.now() - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
  const since = new Date(`${keys[0]}T00:00:00.000Z`);
  return { keys, since, prevSince: new Date(since.getTime() - days * DAY_MS) };
}

const dayOf = (column: AnyPgColumn) => sql<string>`to_char(date_trunc('day', ${column}), 'YYYY-MM-DD')`;

function metric(rows: DayRow[], keys: string[]): Metric {
  const first = keys[0] ?? '';
  const byDay = new Map(rows.map((row) => [row.day, Number(row.value)]));
  return {
    values: keys.map((key) => byDay.get(key) ?? 0),
    previous: rows.filter((row) => row.day < first).reduce((total, row) => total + Number(row.value), 0),
  };
}

function pick<T extends { day: string }>(rows: T[], field: keyof T): DayRow[] {
  return rows.map((row) => ({ day: row.day, value: Number(row[field]) }));
}

async function dailyCount(table: PgTable, createdAt: AnyPgColumn, from: Date, where?: SQL) {
  const day = dayOf(createdAt);
  return db
    .select({ day, value: count() })
    .from(table)
    .where(and(gte(createdAt, from), where))
    .groupBy(day);
}

async function visitDays(from: Date) {
  const day = dayOf(pageVisits.createdAt);
  return db
    .select({
      day,
      views: count(),
      visitors: countDistinct(pageVisits.visitor),
      returning: sql<number>`count(distinct ${pageVisits.visitor}) filter (where ${pageVisits.returning})::int`,
      organic: sql<number>`count(*) filter (where ${pageVisits.landing} and ${pageVisits.source} = 'organic')::int`,
    })
    .from(pageVisits)
    .where(gte(pageVisits.createdAt, from))
    .groupBy(day);
}

async function topPosts(since: Date, limit: number) {
  const views = count();
  return db
    .select({
      postId: posts.id,
      title: posts.title,
      slug: posts.slug,
      views,
      visitors: countDistinct(pageVisits.visitor),
      readThrough: sql<number>`coalesce(round(avg(${pageVisits.readDepth}) filter (where ${pageVisits.readDepth} > 0)), 0)::int`,
    })
    .from(pageVisits)
    .innerJoin(posts, eq(posts.id, pageVisits.postId))
    .where(gte(pageVisits.createdAt, since))
    .groupBy(posts.id, posts.title, posts.slug)
    .orderBy(desc(views))
    .limit(limit);
}

/** Counts visits by where they started (the first page of each visit). */
async function landingsBy(column: AnyPgColumn, since: Date, where?: SQL, limit = 10) {
  const visits = count();
  return db
    .select({ key: column, visits })
    .from(pageVisits)
    .where(and(gte(pageVisits.createdAt, since), eq(pageVisits.landing, true), where))
    .groupBy(column)
    .orderBy(desc(visits))
    .limit(limit);
}

export function engineName(host: string) {
  if (/(^|\.)google\./.test(host)) return 'Google';
  if (host.includes('bing.')) return 'Bing';
  if (host.includes('duckduckgo.')) return 'DuckDuckGo';
  if (host.includes('yahoo.')) return 'Yahoo';
  if (host.includes('ecosia.')) return 'Ecosia';
  if (host.includes('yandex.')) return 'Yandex';
  if (host.includes('baidu.')) return 'Baidu';
  if (host.includes('brave.')) return 'Brave';
  return host;
}

const sourceRows = (rows: { key: unknown; visits: number }[]) =>
  rows.map((row) => ({ source: String(row.key), visits: row.visits }));

export async function getOverview(days: number) {
  await deleteOldVisits();
  const { keys, since, prevSince } = windowFor(days);

  const [visits, signups, commentRows, questions, top, sources] = await Promise.all([
    visitDays(prevSince),
    dailyCount(users, users.createdAt, prevSince, eq(users.role, 'reader')),
    dailyCount(comments, comments.createdAt, prevSince, isNull(comments.deletedAt)),
    dailyCount(askEvents, askEvents.createdAt, prevSince, eq(askEvents.audience, 'reader')),
    topPosts(since, 5),
    landingsBy(pageVisits.source, since, ne(pageVisits.source, 'internal')),
  ]);

  return {
    days,
    dates: keys,
    kpis: {
      visitors: metric(pick(visits, 'visitors'), keys),
      views: metric(pick(visits, 'views'), keys),
      returning: metric(pick(visits, 'returning'), keys),
      signups: metric(signups, keys),
      comments: metric(commentRows, keys),
      questions: metric(questions, keys),
    },
    topPosts: top,
    sources: sourceRows(sources),
  };
}

export async function getTraffic(days: number) {
  await deleteOldVisits();
  const { keys, since, prevSince } = windowFor(days);
  const linked = and(isNotNull(pageVisits.referrerHost), inArray(pageVisits.source, ['social', 'referral']));

  const [visits, sources, engines, referrers, devices, signedInRows, pages] = await Promise.all([
    visitDays(prevSince),
    landingsBy(pageVisits.source, since, ne(pageVisits.source, 'internal')),
    landingsBy(pageVisits.referrerHost, since, eq(pageVisits.source, 'organic'), 50),
    landingsBy(pageVisits.referrerHost, since, linked, 8),
    landingsBy(pageVisits.device, since),
    landingsBy(pageVisits.signedIn, since),
    db
      .select({ path: pageVisits.path, views: count() })
      .from(pageVisits)
      .where(and(gte(pageVisits.createdAt, since), isNull(pageVisits.postId)))
      .groupBy(pageVisits.path)
      .orderBy(desc(count()))
      .limit(8),
  ]);

  const visitors = metric(pick(visits, 'visitors'), keys);
  const returning = metric(pick(visits, 'returning'), keys);

  const byEngine = new Map<string, number>();
  for (const row of engines) {
    const name = engineName(String(row.key));
    byEngine.set(name, (byEngine.get(name) ?? 0) + row.visits);
  }

  return {
    days,
    dates: keys,
    visitors,
    views: metric(pick(visits, 'views'), keys),
    returning,
    newVisitors: {
      values: visitors.values.map((value, index) => Math.max(0, value - (returning.values[index] ?? 0))),
      previous: Math.max(0, visitors.previous - returning.previous),
    },
    organic: metric(pick(visits, 'organic'), keys),
    sources: sourceRows(sources),
    engines: [...byEngine].map(([name, visits]) => ({ name, visits })).sort((a, b) => b.visits - a.visits),
    referrers: referrers.map((row) => ({ host: String(row.key), visits: row.visits })),
    devices: devices.map((row) => ({ device: String(row.key), visits: row.visits })),
    signedIn: {
      readers: signedInRows.find((row) => row.key === true)?.visits ?? 0,
      guests: signedInRows.find((row) => row.key === false)?.visits ?? 0,
    },
    pages,
  };
}

export async function getContent(days: number) {
  const { keys, since, prevSince } = windowFor(days);
  const approved = and(eq(comments.status, 'approved'), isNull(comments.deletedAt));
  const commentCount = count();
  const postCount = count();

  const [[counts], top, mostCommented, topics, commentDays] = await Promise.all([
    db
      .select({
        total: count(),
        published: sql<number>`count(*) filter (where ${posts.published})::int`,
        drafts: sql<number>`count(*) filter (where not ${posts.published})::int`,
      })
      .from(posts),
    topPosts(since, 10),
    db
      .select({ postId: posts.id, title: posts.title, slug: posts.slug, comments: commentCount })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .where(and(approved, gte(comments.createdAt, since)))
      .groupBy(posts.id, posts.title, posts.slug)
      .orderBy(desc(commentCount))
      .limit(5),
    db
      .select({ name: categories.name, slug: categories.slug, posts: postCount })
      .from(postCategories)
      .innerJoin(categories, eq(categories.id, postCategories.categoryId))
      .innerJoin(posts, eq(posts.id, postCategories.postId))
      .where(eq(posts.published, true))
      .groupBy(categories.name, categories.slug)
      .orderBy(desc(postCount)),
    dailyCount(comments, comments.createdAt, prevSince, approved),
  ]);

  const ids = top.map((post) => post.postId);
  const perPost = ids.length
    ? await db
        .select({ postId: comments.postId, comments: count() })
        .from(comments)
        .where(and(approved, gte(comments.createdAt, since), inArray(comments.postId, ids)))
        .groupBy(comments.postId)
    : [];
  const topicNames = ids.length
    ? await db
        .select({ postId: postCategories.postId, name: categories.name })
        .from(postCategories)
        .innerJoin(categories, eq(categories.id, postCategories.categoryId))
        .where(inArray(postCategories.postId, ids))
    : [];

  return {
    days,
    dates: keys,
    counts: counts ?? { total: 0, published: 0, drafts: 0 },
    posts: top.map((post) => ({
      ...post,
      comments: perPost.find((row) => row.postId === post.postId)?.comments ?? 0,
      topics: topicNames.filter((row) => row.postId === post.postId).map((row) => row.name),
    })),
    mostCommented,
    topics,
    comments: metric(commentDays, keys),
  };
}

export async function getPeople(days: number) {
  const { keys, since, prevSince } = windowFor(days);

  const [[counts], signups, [signedIn]] = await Promise.all([
    db
      .select({
        readers: sql<number>`count(*) filter (where ${users.role} = 'reader')::int`,
        verified: sql<number>`count(*) filter (where ${users.role} = 'reader' and ${users.emailVerifiedAt} is not null)::int`,
        banned: sql<number>`count(*) filter (where ${users.bannedAt} is not null)::int`,
        admins: sql<number>`count(*) filter (where ${users.role} = 'admin' and ${users.status} = 'active')::int`,
        superAdmins: sql<number>`count(*) filter (where ${users.role} = 'super_admin' and ${users.status} = 'active')::int`,
        waiting: sql<number>`count(*) filter (where ${users.role} <> 'reader' and ${users.status} = 'pending')::int`,
      })
      .from(users),
    dailyCount(users, users.createdAt, prevSince, eq(users.role, 'reader')),
    db
      .select({ visitors: countDistinct(pageVisits.visitor) })
      .from(pageVisits)
      .where(and(gte(pageVisits.createdAt, since), eq(pageVisits.signedIn, true))),
  ]);

  const totals = counts ?? { readers: 0, verified: 0, banned: 0, admins: 0, superAdmins: 0, waiting: 0 };
  return {
    days,
    dates: keys,
    counts: { ...totals, notVerified: totals.readers - totals.verified, signedInVisitors: signedIn?.visitors ?? 0 },
    signups: metric(signups, keys),
  };
}