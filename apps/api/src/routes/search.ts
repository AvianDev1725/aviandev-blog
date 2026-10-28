import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { searchPosts } from '../data/search.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { recordSearch } from '../data/search-insights.js';
import { isBot } from '../lib/views.js';
import { validateJson } from '../lib/validate.js';

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

const eventSchema = z.object({
  clientId: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[a-z0-9-]+$/i)
    .optional(),
  query: z.string().trim().min(2).max(200),
  resultCount: z.number().int().min(0).max(100),
  topic: z.string().trim().max(100).optional(),
  openedUrl: z
    .string()
    .max(300)
    .regex(/^\/posts\/[a-z0-9-]+(#[a-z0-9-]+)?$/)
    .optional(),
  progress: z.union([z.literal(0), z.literal(50), z.literal(100)]).optional(),
});

const eventLimit = process.env.NODE_ENV === 'test' ? passThrough : rateLimit({ windowMs: 60 * 1000, max: 60 });

searchRoute.post('/events', eventLimit, validateJson(eventSchema), async (c) => {
  if (!isBot(c.req.header('user-agent') ?? '')) await recordSearch(c.req.valid('json'));
  return c.body(null, 204);
});

export default searchRoute;