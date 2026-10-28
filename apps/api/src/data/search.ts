import { and, asc, cosineDistance, desc, eq, inArray, isNotNull, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, postCategories, posts, postSections } from '../db/schema.js';
import { embedQuery } from '../lib/embeddings.js';

const CANDIDATES = 30;
const MIN_MEANING_SIMILARITY = 0.6;
const MIN_TYPO_SIMILARITY = 0.5;
const FUSION_K = 60;
const WEIGHTS = { keyword: 1, meaning: 1, typo: 0.6 } as const;

type Signal = keyof typeof WEIGHTS;
export type SnippetPart = { text: string; highlight: boolean };

const START = '\u0002';
const STOP = '\u0003';

const sectionText = sql`${postSections.heading} || ' ' || ${postSections.content}`;

export function toSnippetParts(snippet: string): SnippetPart[] {
  const clean = snippet.replace(/\s+/g, ' ').trim();
  const [before, ...rest] = clean.split(START);
  const parts: SnippetPart[] = [];
  if (before) parts.push({ text: before, highlight: false });
  for (const piece of rest) {
    const [hit, after = ''] = piece.split(STOP);
    if (hit) parts.push({ text: hit, highlight: true });
    if (after) parts.push({ text: after, highlight: false });
  }
  return parts;
}

function topicFilter(topic?: string): SQL | undefined {
  if (!topic) return undefined;
  return inArray(
    postSections.postId,
    db
      .select({ id: postCategories.postId })
      .from(postCategories)
      .innerJoin(categories, eq(postCategories.categoryId, categories.id))
      .where(eq(categories.slug, topic)),
  );
}

async function keywordMatches(query: SQL, filter?: SQL) {
  const document = sql`to_tsvector('english', ${sectionText})`;
  const rank = sql<number>`ts_rank_cd(${document}, ${query})`;
  const rows = await db
    .select({ id: postSections.id })
    .from(postSections)
    .where(and(sql`${document} @@ ${query}`, filter))
    .orderBy(desc(rank))
    .limit(CANDIDATES);
  return rows.map((row) => row.id);
}

async function meaningMatches(text: string, filter?: SQL) {
  let vector: number[];
  try {
    vector = await embedQuery(text);
  } catch (error) {
    console.error('[search] meaning search unavailable, using keywords only:', error);
    return [];
  }
  const distance = cosineDistance(postSections.embedding, vector);
  return db
    .select({ id: postSections.id, similarity: sql<number>`1 - (${distance})` })
    .from(postSections)
    .where(and(isNotNull(postSections.embedding), filter))
    .orderBy(asc(distance))
    .limit(CANDIDATES);
}

async function typoMatches(text: string, filter?: SQL) {
  const similarity = sql<number>`word_similarity(${text.toLowerCase()}, lower(${sectionText}))`;
  const rows = await db
    .select({ id: postSections.id })
    .from(postSections)
    .where(and(sql`${similarity} >= ${MIN_TYPO_SIMILARITY}`, filter))
    .orderBy(desc(similarity))
    .limit(CANDIDATES);
  return rows.map((row) => row.id);
}

async function loadSections(ids: number[], query: SQL, signals: Map<number, Signal[]>) {
  if (ids.length === 0) return [];

  const options = sql`'StartSel=' || chr(2) || ', StopSel=' || chr(3) || ', MaxWords=30, MinWords=15, ShortWord=2, MaxFragments=1'`;
  const rows = await db
    .select({
      id: postSections.id,
      postId: postSections.postId,
      anchor: postSections.anchor,
      heading: postSections.heading,
      postSlug: posts.slug,
      postTitle: posts.title,
      publishedAt: posts.publishedAt,
      readingMinutes: posts.readingMinutes,
      snippet: sql<string>`ts_headline('english', ${postSections.content}, ${query}, ${options})`,
    })
    .from(postSections)
    .innerJoin(posts, eq(postSections.postId, posts.id))
    .where(inArray(postSections.id, ids));

  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();

  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const key = `${row.postId}#${row.anchor}`;
    if (seen.has(key)) return [];
    seen.add(key);

    const { snippet, ...rest } = row;
    return [
      {
        ...rest,
        url: row.anchor ? `/posts/${row.postSlug}#${row.anchor}` : `/posts/${row.postSlug}`,
        snippet: toSnippetParts(snippet),
        matchedBy: signals.get(id) ?? (['meaning'] as Signal[]),
      },
    ];
  });
}

async function topicsFor(postIds: number[]) {
  if (postIds.length === 0) return [];
  return db
    .select({
      slug: categories.slug,
      name: categories.name,
      count: sql<number>`count(distinct ${postCategories.postId})::int`,
    })
    .from(postCategories)
    .innerJoin(categories, eq(postCategories.categoryId, categories.id))
    .where(inArray(postCategories.postId, postIds))
    .groupBy(categories.slug, categories.name)
    .orderBy(desc(sql`count(distinct ${postCategories.postId})`), asc(categories.name));
}

export async function searchPosts(text: string, options: { topic?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 20);
  const filter = topicFilter(options.topic);
  const query = sql`websearch_to_tsquery('english', ${text})`;

  const [keyword, meaning, typo] = await Promise.all([
    keywordMatches(query, filter),
    meaningMatches(text, filter),
    typoMatches(text, filter),
  ]);
  const strongMeaning = meaning.filter((row) => row.similarity >= MIN_MEANING_SIMILARITY).map((row) => row.id);

  const scores = new Map<number, number>();
  const signals = new Map<number, Signal[]>();
  const add = (ids: number[], signal: Signal) =>
    ids.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + WEIGHTS[signal] / (FUSION_K + index + 1));
      signals.set(id, [...(signals.get(id) ?? []), signal]);
    });
  add(keyword, 'keyword');
  add(strongMeaning, 'meaning');
  add(typo, 'typo');

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const results = (await loadSections(ranked.slice(0, limit * 2), query, signals)).slice(0, limit);

  const suggestions =
    results.length === 0
      ? (await loadSections(meaning.slice(0, 6).map((row) => row.id), query, signals)).slice(0, 3)
      : [];

  const topics = await topicsFor([...new Set(results.map((result) => result.postId))]);
  return { query: text, results, suggestions, topics };
}