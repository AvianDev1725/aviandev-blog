import { Hono } from 'hono';
import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { comments, posts, users } from '../db/schema.js';
import { canWrite, requireRole, type AuthEnv } from '../middleware/auth.js';
import { canModerate } from '../lib/comment-rules.js';
import { notifyChanged } from '../lib/revalidate.js';

type Status = 'pending' | 'approved' | 'spam';
const STATUSES: Status[] = ['pending', 'approved', 'spam'];

const moderation = new Hono<AuthEnv>();
moderation.use('*', ...canWrite);

async function refreshPosts(postIds: number[]) {
  if (postIds.length === 0) return;
  const rows = await db.select({ slug: posts.slug }).from(posts).where(inArray(posts.id, [...new Set(postIds)]));
  await notifyChanged(rows.map((row) => `post:${row.slug}`));
}

async function loadForModeration(id: number, user: AuthEnv['Variables']['user']) {
  if (!Number.isInteger(id)) return null;
  const [row] = await db
    .select({ id: comments.id, status: comments.status, postId: comments.postId, authorId: posts.authorId })
    .from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(eq(comments.id, id));
  return row && canModerate(user, row.authorId) ? row : null;
}

moderation.get('/comments', async (c) => {
  const user = c.get('user');
  const requested = c.req.query('status') as Status | undefined;
  const status: Status = requested && STATUSES.includes(requested) ? requested : 'pending';
  const scope = user.role === 'super_admin' ? undefined : eq(posts.authorId, user.id);

  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      body: comments.body,
      status: comments.status,
      guestAvatar: comments.guestAvatar,
      userId: comments.userId,
      editedAt: comments.editedAt,
      createdAt: comments.createdAt,
      authorName: users.name,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorEmail: users.email,
      authorRole: users.role,
      authorBannedAt: users.bannedAt,
      postId: posts.id,
      postTitle: posts.title,
      postSlug: posts.slug,
    })
    .from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .leftJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.status, status), isNull(comments.deletedAt), scope))
    .orderBy(desc(comments.createdAt))
    .limit(200);

  const totals = await db
    .select({ status: comments.status, count: sql<number>`count(*)::int` })
    .from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(and(isNull(comments.deletedAt), scope))
    .groupBy(comments.status);

  const counts = { pending: 0, approved: 0, spam: 0 };
  for (const row of totals) counts[row.status] = row.count;

  return c.json({
    counts,
    comments: rows.map(({ authorEmail, authorBannedAt, ...row }) => ({
      ...row,
      authorEmail: user.role === 'super_admin' ? authorEmail : null,
      authorBanned: authorBannedAt !== null,
    })),
  });
});

moderation.post('/comments/:id/approve', async (c) => {
  const user = c.get('user');
  const row = await loadForModeration(Number(c.req.param('id')), user);
  if (!row) return c.json({ error: 'Comment not found' }, 404);

  await db
    .update(comments)
    .set({ status: 'approved', moderatedBy: user.id, moderatedAt: new Date() })
    .where(eq(comments.id, row.id));
  await refreshPosts([row.postId]);
  return c.json({ ok: true });
});

moderation.post('/comments/:id/spam', async (c) => {
  const user = c.get('user');
  const row = await loadForModeration(Number(c.req.param('id')), user);
  if (!row) return c.json({ error: 'Comment not found' }, 404);

  await db
    .update(comments)
    .set({ status: 'spam', moderatedBy: user.id, moderatedAt: new Date() })
    .where(eq(comments.id, row.id));
  if (row.status === 'approved') await refreshPosts([row.postId]);
  return c.json({ ok: true });
});

moderation.delete('/comments/:id', async (c) => {
  const row = await loadForModeration(Number(c.req.param('id')), c.get('user'));
  if (!row) return c.json({ error: 'Comment not found' }, 404);

  await db.delete(comments).where(eq(comments.id, row.id));
  if (row.status === 'approved') await refreshPosts([row.postId]);
  return c.body(null, 204);
});

moderation.post('/readers/:id/ban', requireRole('super_admin'), async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const [target] = Number.isInteger(id)
    ? await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, id))
    : [];
  if (!target) return c.json({ error: 'Reader not found' }, 404);
  if (target.role !== 'reader') return c.json({ error: 'Only readers can be banned' }, 400);

  await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, id));
  const hidden = await db
    .update(comments)
    .set({ status: 'spam', moderatedBy: user.id, moderatedAt: new Date() })
    .where(and(eq(comments.userId, id), ne(comments.status, 'spam')))
    .returning({ postId: comments.postId });

  await refreshPosts(hidden.map((row) => row.postId));
  return c.json({ ok: true, hidden: hidden.length });
});

moderation.delete('/readers/:id/ban', requireRole('super_admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Reader not found' }, 404);
  await db.update(users).set({ bannedAt: null }).where(eq(users.id, id));
  return c.body(null, 204);
});

export default moderation;