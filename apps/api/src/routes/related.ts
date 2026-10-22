import { Hono } from 'hono';
import { getRelatedPosts } from '../data/posts.js';

const relatedRoute = new Hono();

relatedRoute.get('/:slug', async (c) => {
  const related = await getRelatedPosts(c.req.param('slug'));
  if (!related) return c.json({ error: 'Post not found' }, 404);
  return c.json(related);
});

export default relatedRoute;