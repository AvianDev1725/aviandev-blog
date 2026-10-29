import { and, count, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { askEvents, dismissedSearches } from '../db/schema.js';
import { resolveSections } from './search-insights.js';

export const ASK_KEEP_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function deleteOldAsks() {
  await db.delete(askEvents).where(lt(askEvents.createdAt, new Date(Date.now() - ASK_KEEP_DAYS * DAY_MS)));
}

export async function getAskInsights(days: number) {
  await deleteOldAsks();
  const since = new Date(Date.now() - days * DAY_MS);
  const readers = and(gte(askEvents.createdAt, since), eq(askEvents.audience, 'reader'));

  const questions = count();
  const lastAsked = sql<Date>`max(${askEvents.createdAt})`;
  const day = sql<string>`to_char(date_trunc('day', ${askEvents.createdAt}), 'YYYY-MM-DD')`;

  const cited = db
    .select({ url: sql<string>`unnest(${askEvents.citedUrls})`.as('url') })
    .from(askEvents)
    .where(readers)
    .as('cited');

  const [[totals], perDayRows, unanswered, citedRows] = await Promise.all([
    db
      .select({
        questions,
        answered: sql<number>`count(*) filter (where ${askEvents.status} = 'answered')::int`,
        notFound: sql<number>`count(*) filter (where ${askEvents.status} = 'not_found')::int`,
        errors: sql<number>`count(*) filter (where ${askEvents.status} = 'error')::int`,
        helpful: sql<number>`count(*) filter (where ${askEvents.helpful} = true)::int`,
        notHelpful: sql<number>`count(*) filter (where ${askEvents.helpful} = false)::int`,
      })
      .from(askEvents)
      .where(readers),

    db.select({ day, questions }).from(askEvents).where(readers).groupBy(day).orderBy(day),

    db
      .select({ question: askEvents.question, times: questions, lastAsked })
      .from(askEvents)
      .leftJoin(dismissedSearches, eq(dismissedSearches.query, askEvents.question))
      .where(and(readers, eq(askEvents.status, 'not_found')))
      .groupBy(askEvents.question, dismissedSearches.dismissedAt)
      .having(sql`${dismissedSearches.dismissedAt} is null or max(${askEvents.createdAt}) > ${dismissedSearches.dismissedAt}`)
      .orderBy(desc(questions), desc(lastAsked))
      .limit(20),

    db.select({ url: cited.url, times: count() }).from(cited).groupBy(cited.url).orderBy(desc(count())).limit(10),
  ]);

  const byDay = new Map(perDayRows.map((row) => [row.day, row.questions]));
  const perDay = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.now() - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10);
    return { day: date, questions: byDay.get(date) ?? 0 };
  });

  const names = await resolveSections(citedRows.map((row) => row.url));
  const sections = citedRows.flatMap((row) => {
    const name = names.get(row.url);
    return name ? [{ url: row.url, times: row.times, ...name }] : [];
  });

  return {
    days,
    totals: totals ?? { questions: 0, answered: 0, notFound: 0, errors: 0, helpful: 0, notHelpful: 0 },
    perDay,
    unanswered,
    sections,
  };
}