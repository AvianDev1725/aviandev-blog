import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts } from '../db/schema.js';
import { isBot, recordView, totalViews } from '../lib/views.js';

const viewsRoute = new Hono();

viewsRoute.post('/:slug', async (c) => {
  c.header('Cache-Control', 'no-store');

  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.slug, c.req.param('slug')), eq(posts.published, true)));
  if (!post) return c.json({ error: 'Post not found' }, 404);

  const userAgent = c.req.header('user-agent') ?? '';
  if (!isBot(userAgent)) {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
    await recordView(post.id, ip, userAgent);
  }

  return c.json({ views: await totalViews(post.id) });
});

export default viewsRoute;