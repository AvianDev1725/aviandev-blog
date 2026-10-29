import { Hono } from 'hono';
import { z } from 'zod';
import { getContent, getOverview, getPeople, getTraffic } from '../data/analytics.js';
import { getAskInsights } from '../data/ask-insights.js';
import { dismissSearch, getSearchInsights } from '../data/search-insights.js';
import { requireAuth, requireRole, type AuthEnv } from '../middleware/auth.js';
import { validateJson } from '../lib/validate.js';

const insights = new Hono<AuthEnv>();
insights.use('*', requireAuth, requireRole('super_admin'));

const daysFrom = (value?: string) => (value === '90' ? 90 : value === '30' ? 30 : 7);

insights.get('/overview', async (c) => c.json(await getOverview(daysFrom(c.req.query('days')))));
insights.get('/traffic', async (c) => c.json(await getTraffic(daysFrom(c.req.query('days')))));
insights.get('/content', async (c) => c.json(await getContent(daysFrom(c.req.query('days')))));
insights.get('/people', async (c) => c.json(await getPeople(daysFrom(c.req.query('days')))));
insights.get('/search', async (c) => c.json(await getSearchInsights(daysFrom(c.req.query('days')))));
insights.get('/ask', async (c) => c.json(await getAskInsights(daysFrom(c.req.query('days')))));

insights.post('/search/dismiss', validateJson(z.object({ query: z.string().trim().min(2).max(200) })), async (c) => {
  await dismissSearch(c.req.valid('json').query, c.get('user').id);
  return c.body(null, 204);
});

export default insights;