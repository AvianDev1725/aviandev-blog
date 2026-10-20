import { Hono } from 'hono';
import { canWrite, type AuthEnv } from '../middleware/auth.js';
import { canEditPost } from '../lib/permissions.js';
import { getPostWithCategories, listPostsForEditor, getPostById } from '../data/posts.js';
import { createPreviewToken } from '../lib/preview-token.js';

const adminPostsRoute = new Hono<AuthEnv>();

adminPostsRoute.use('*', ...canWrite);

adminPostsRoute.get('/', async (c) => c.json(await listPostsForEditor(c.get('user'))));

adminPostsRoute.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid id' }, 400);

  const post = await getPostWithCategories(id);
  if (!post) return c.json({ error: 'Post not found' }, 404);
  if (!canEditPost(c.get('user'), post)) return c.json({ error: 'Forbidden' }, 403);

  return c.json(post);
});

adminPostsRoute.post('/:id/preview', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid id' }, 400);

  const post = await getPostById(id);
  if (!post) return c.json({ error: 'Post not found' }, 404);
  if (!canEditPost(c.get('user'), post)) return c.json({ error: 'Forbidden' }, 403);

  return c.json(createPreviewToken(id), 201);
});

export default adminPostsRoute;