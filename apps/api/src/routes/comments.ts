import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { comments, posts, users } from '../db/schema.js';
import { getPublicComment, getPublicComments } from '../data/comments.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { cleanBody, GUEST_AVATARS, initialStatus, looksLikeBot, MAX_COMMENT_LENGTH } from '../lib/comment-rules.js';
import { emails, sendEmail } from '../lib/email.js';
import { notifyChanged } from '../lib/revalidate.js';
import { getSessionUser, SESSION_COOKIE } from '../lib/session.js';
import { validateJson } from '../lib/validate.js';

const bodyField = z
  .string()
  .trim()
  .min(1, 'Write a comment first')
  .max(MAX_COMMENT_LENGTH, `Comments can be up to ${MAX_COMMENT_LENGTH.toLocaleString('en-IN')} characters`);

const createSchema = z.object({
  postSlug: z.string().min(1).max(200),
  parentId: z.number().int().positive().optional(),
  body: bodyField,
  guestAvatar: z.enum(GUEST_AVATARS).optional(),
  website: z.string().max(200).optional(),
  startedAt: z.number().int().optional(),
});

const editSchema = z.object({ body: bodyField });

const passThrough = createMiddleware(async (_c, next) => next());
const commentLimit =
  process.env.NODE_ENV === 'test' ? passThrough : rateLimit({ windowMs: 60 * 1000, max: 5 });

async function findPublishedPost(slug: string) {
  const [post] = await db
    .select({ id: posts.id, slug: posts.slug, title: posts.title, authorId: posts.authorId })
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.published, true)));
  return post;
}

async function refreshPost(slug: string) {
  await notifyChanged([`post:${slug}`]);
}

async function notifyAuthor(post: { title: string; authorId: number }, body: string) {
  try {
    const [author] = await db
      .select({ email: users.email, status: users.status })
      .from(users)
      .where(eq(users.id, post.authorId));
    if (!author || author.status !== 'active') return;

    const [recent] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .where(
        and(
          eq(posts.authorId, post.authorId),
          isNull(comments.userId),
          gt(comments.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
        ),
      );
    if ((recent?.count ?? 0) > 5) return;

    await sendEmail({ to: author.email, ...(await emails.commentWaiting(post.title, body)) });
  } catch (err) {
    console.error('[comment notification failed]', err);
  }
}

const commentsRoute = new Hono<AuthEnv>();

commentsRoute.get('/', async (c) => {
  const post = await findPublishedPost(c.req.query('post') ?? '');
  if (!post) return c.json({ error: 'Post not found' }, 404);

  const list = await getPublicComments(post.id);
  return c.json({ count: list.filter((comment) => !comment.deleted).length, comments: list });
});

commentsRoute.post('/', commentLimit, validateJson(createSchema), async (c) => {
  const input = c.req.valid('json');
  if (looksLikeBot(input)) return c.json({ status: 'pending', comment: null }, 202);

  const body = cleanBody(input.body);
  if (!body) return c.json({ error: 'Write a comment first' }, 400);

  const post = await findPublishedPost(input.postSlug);
  if (!post) return c.json({ error: 'Post not found' }, 404);

  const token = getCookie(c, SESSION_COOKIE);
  const sessionUser = token ? await getSessionUser(token) : null;

  let commenter: { id: number; role: 'reader' | 'admin' | 'super_admin' } | null = null;
  if (sessionUser) {
    const [user] = await db
      .select({ id: users.id, role: users.role, bannedAt: users.bannedAt, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, sessionUser.id));
    if (!user) return c.json({ error: 'Not logged in' }, 401);
    if (user.bannedAt) return c.json({ error: "You can't comment on this blog" }, 403);
    if (!user.emailVerifiedAt) return c.json({ error: 'Confirm your email to comment' }, 403);
    commenter = { id: user.id, role: user.role };
  } else if (!input.guestAvatar) {
    return c.json({ error: 'Choose an avatar' }, 400);
  }

  let parentId: number | null = null;
  if (input.parentId) {
    const [parent] = await db
      .select({ id: comments.id, parentId: comments.parentId, postId: comments.postId, status: comments.status, deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, input.parentId));
    if (!parent || parent.postId !== post.id || parent.status !== 'approved' || parent.deletedAt) {
      return c.json({ error: "You can't reply to that comment" }, 400);
    }
    parentId = parent.parentId ?? parent.id;
  }

  const status = initialStatus(commenter, body);
  const [created] = await db
    .insert(comments)
    .values({
      postId: post.id,
      parentId,
      userId: commenter?.id ?? null,
      guestAvatar: commenter ? null : input.guestAvatar,
      body,
      status,
    })
    .returning({ id: comments.id });

  if (status === 'approved') await refreshPost(post.slug);
  else if (!commenter) void notifyAuthor(post, body);

  const comment = status === 'approved' ? await getPublicComment(created.id) : null;
  return c.json({ status, comment }, 201);
});

async function findOwnComment(id: number, userId: number) {
  const [row] = await db
    .select({ id: comments.id, userId: comments.userId, status: comments.status, deletedAt: comments.deletedAt, slug: posts.slug })
    .from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(eq(comments.id, id));
  if (!row || row.userId !== userId || row.deletedAt || row.status === 'spam') return null;
  return row;
}

commentsRoute.patch('/:id', requireAuth, validateJson(editSchema), async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const row = Number.isInteger(id) ? await findOwnComment(id, user.id) : null;
  if (!row) return c.json({ error: 'Comment not found' }, 404);

  const [account] = await db.select({ bannedAt: users.bannedAt }).from(users).where(eq(users.id, user.id));
  if (account?.bannedAt) return c.json({ error: "You can't comment on this blog" }, 403);

  const body = cleanBody(c.req.valid('json').body);
  if (!body) return c.json({ error: 'Write a comment first' }, 400);

  const status = row.status === 'pending' ? 'pending' : initialStatus(user, body);
  await db.update(comments).set({ body, status, editedAt: new Date() }).where(eq(comments.id, id));
  if (row.status === 'approved') await refreshPost(row.slug);

  return c.json({ status, comment: status === 'approved' ? await getPublicComment(id) : null });
});

commentsRoute.delete('/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  const row = Number.isInteger(id) ? await findOwnComment(id, c.get('user').id) : null;
  if (!row) return c.json({ error: 'Comment not found' }, 404);

  const [reply] = await db.select({ id: comments.id }).from(comments).where(eq(comments.parentId, id)).limit(1);
  if (reply) await db.update(comments).set({ deletedAt: new Date(), body: '' }).where(eq(comments.id, id));
  else await db.delete(comments).where(eq(comments.id, id));

  if (row.status === 'approved') await refreshPost(row.slug);
  return c.body(null, 204);
});

export default commentsRoute;