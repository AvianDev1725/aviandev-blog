import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { searchPosts } from '../data/search.js';
import { rateLimit } from '../middleware/rate-limit.js';

const searchSchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(200, 'Searches can be up to 200 characters'),
  topic: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const passThrough = createMiddleware(async (_c, next) => next());
const searchLimit = process.env.NODE_ENV === 'test' ? passThrough : rateLimit({ windowMs: 60 * 1000, max: 60 });

const searchRoute = new Hono();

searchRoute.get('/', searchLimit, async (c) => {
  const parsed = searchSchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid search' }, 400);

  const { q, topic, limit } = parsed.data;
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(await searchPosts(q, { topic: topic || undefined, limit }));
});

export default searchRoute;