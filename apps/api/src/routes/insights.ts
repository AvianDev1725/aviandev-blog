import { Hono } from 'hono';
import { z } from 'zod';
import { dismissSearch, getSearchInsights } from '../data/search-insights.js';
import { requireAuth, requireRole, type AuthEnv } from '../middleware/auth.js';
import { validateJson } from '../lib/validate.js';

const insights = new Hono<AuthEnv>();
insights.use('*', requireAuth, requireRole('super_admin'));

insights.get('/search', async (c) => {
  const days = c.req.query('days') === '30' ? 30 : 7;
  return c.json(await getSearchInsights(days));
});

insights.post('/search/dismiss', validateJson(z.object({ query: z.string().trim().min(2).max(200) })), async (c) => {
  await dismissSearch(c.req.valid('json').query, c.get('user').id);
  return c.body(null, 204);
});

export default insights;