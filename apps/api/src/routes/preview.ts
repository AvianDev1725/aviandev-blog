import { Hono } from 'hono';
import { getPreviewPost } from '../data/posts.js';
import { verifyPreviewToken } from '../lib/preview-token.js';

const previewRoute = new Hono();

previewRoute.get('/:token', async (c) => {
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex');

  const postId = verifyPreviewToken(c.req.param('token'));
  if (!postId) return c.json({ error: 'This preview link is invalid or has expired' }, 401);

  const post = await getPreviewPost(postId);
  if (!post) return c.json({ error: 'Post not found' }, 404);
  return c.json(post);
});

export default previewRoute;