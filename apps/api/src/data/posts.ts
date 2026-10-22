import { and, desc, eq, getTableColumns, inArray, sql, ne, notInArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, postCategories, posts, users, postViews } from '../db/schema.js';
import { readingMinutes } from '../lib/reading-time.js';

export type NewPost = typeof posts.$inferInsert;
export type PostInput = NewPost & { categoryIds?: number[] };
type Post = typeof posts.$inferSelect;

const viewCount = sql<number>`(select coalesce(sum(${postViews.views}), 0)::int from ${postViews} where ${postViews.postId} = ${posts.id})`;

async function attachCategories<T extends { id: number }>(rows: T[]) {
  if (rows.length === 0) return [];

  const links = await db
    .select({ postId: postCategories.postId, id: categories.id, name: categories.name, slug: categories.slug })
    .from(postCategories)
    .innerJoin(categories, eq(postCategories.categoryId, categories.id))
    .where(inArray(postCategories.postId, rows.map((row) => row.id)));

  return rows.map((row) => ({
    ...row,
    categories: links
      .filter((link) => link.postId === row.id)
      .map((link) => ({ id: link.id, name: link.name, slug: link.slug })),
  }));
}

async function setPostCategories(postId: number, categoryIds: number[]) {
  await db.delete(postCategories).where(eq(postCategories.postId, postId));
  if (categoryIds.length > 0) {
    await db.insert(postCategories).values(categoryIds.map((categoryId) => ({ postId, categoryId })));
  }
}

export async function findMissingCategories(ids: number[]) {
  if (ids.length === 0) return [];
  const found = await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, ids));
  const foundIds = new Set(found.map((row) => row.id));
  return ids.filter((id) => !foundIds.has(id));
}

const summaryColumns = {
  id: posts.id,
  title: posts.title,
  slug: posts.slug,
  excerpt: posts.excerpt,
  publishedAt: posts.publishedAt,
  updatedAt: posts.updatedAt,
  noindex: posts.noindex,
  views: viewCount,
  readingMinutes: posts.readingMinutes,
};

export async function getPublishedPosts(categorySlug?: string) {
  const conditions = [eq(posts.published, true)];

  if (categorySlug) {
    const postsInCategory = db
      .select({ id: postCategories.postId })
      .from(postCategories)
      .innerJoin(categories, eq(postCategories.categoryId, categories.id))
      .where(eq(categories.slug, categorySlug));
    conditions.push(inArray(posts.id, postsInCategory));
  }

  const rows = await db
    .select(summaryColumns)
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.publishedAt));
  return attachCategories(rows);
}

export async function getPublishedPostBySlug(slug: string) {
  const rows = await db
    .select({ ...getTableColumns(posts), authorName: users.name })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.slug, slug), eq(posts.published, true)));
  const [post] = await attachCategories(rows);
  return post;
}

export async function getPostById(id: number) {
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  return post;
}

export async function createPost({ categoryIds = [], ...input }: PostInput) {
  const [post] = await db
    .insert(posts)
    .values({
      ...input,
      publishedAt: input.published ? new Date() : null,
      readingMinutes: readingMinutes(input.content),
    })
    .returning();

  await setPostCategories(post.id, categoryIds);
  const [withCategories] = await attachCategories([post]);
  return withCategories;
}

export async function updatePost(id: number, { categoryIds, ...input }: Partial<PostInput>) {
  const [post] = await db
    .update(posts)
    .set({
      ...input,
      updatedAt: new Date(),
      ...(input.published === true && { publishedAt: sql`coalesce(${posts.publishedAt}, now())` }),
      ...(input.content !== undefined && { readingMinutes: readingMinutes(input.content) }),
    })
    .where(eq(posts.id, id))
    .returning();
  if (!post) return undefined;

  if (categoryIds) await setPostCategories(id, categoryIds);
  const [withCategories] = await attachCategories([post]);
  return withCategories;
}

export async function deletePost(id: number) {
  const [post] = await db.delete(posts).where(eq(posts.id, id)).returning();
  return post;
}

export async function listPostsForEditor(user: { id: number; role: string }) {
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      published: posts.published,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      authorId: posts.authorId,
      authorName: users.name,
      views: viewCount,
      readingMinutes: posts.readingMinutes,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(user.role === 'super_admin' ? undefined : eq(posts.authorId, user.id))
    .orderBy(desc(posts.updatedAt));

  return attachCategories(rows);
}

export async function getPostWithCategories(id: number) {
  const rows = await db.select().from(posts).where(eq(posts.id, id));
  const [post] = await attachCategories(rows);
  return post;
}

export async function getPreviewPost(id: number) {
  const rows = await db
    .select({ ...getTableColumns(posts), authorName: users.name })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, id));
  const [post] = await attachCategories(rows);
  return post;
}

export async function getRelatedPosts(slug: string, limit = 3) {
  const [current] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.published, true)));
  if (!current) return null;

  const visibleOthers = (exclude: number[]) =>
    and(eq(posts.published, true), eq(posts.noindex, false), notInArray(posts.id, exclude));

  const currentTopics = db
    .select({ id: postCategories.categoryId })
    .from(postCategories)
    .where(eq(postCategories.postId, current.id));
  const sharedTopics = sql<number>`count(${postCategories.categoryId})::int`;

  const bestMatches = await db
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(postCategories, and(eq(postCategories.postId, posts.id), inArray(postCategories.categoryId, currentTopics)))
    .where(visibleOthers([current.id]))
    .groupBy(posts.id)
    .orderBy(desc(sharedTopics), desc(posts.publishedAt))
    .limit(limit);

  const ids = bestMatches.map((row) => row.id);

  if (ids.length < limit) {
    const latest = await db
      .select({ id: posts.id })
      .from(posts)
      .where(visibleOthers([current.id, ...ids]))
      .orderBy(desc(posts.publishedAt))
      .limit(limit - ids.length);
    ids.push(...latest.map((row) => row.id));
  }

  if (ids.length === 0) return [];

  const rows = await db.select(summaryColumns).from(posts).where(inArray(posts.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => byId.get(id)).filter((row) => row !== undefined);
  return attachCategories(ordered);
}