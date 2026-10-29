import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { askVisitor } from '../data/ask.js';
import { recordVisit, saveReadDepth } from '../data/visits.js';
import { classifySource, clientIp, deviceFrom } from '../lib/traffic.js';
import { validateJson } from '../lib/validate.js';
import { isBot } from '../lib/views.js';
import { rateLimit } from '../middleware/rate-limit.js';

const visitId = z.string().regex(/^[a-z0-9-]{8,64}$/i);

const visitSchema = z.object({
  id: visitId,
  path: z.string().max(300).regex(/^\/[^\s?#]*$/),
  landing: z.boolean(),
  returning: z.boolean(),
  signedIn: z.boolean(),
  referrer: z.string().max(500).optional(),
  utmSource: z.string().max(100).optional(),
});

const depthSchema = z.object({ id: visitId, depth: z.number().int().min(0).max(100) });

const passThrough = createMiddleware(async (_c, next) => next());
const trackLimit = process.env.NODE_ENV === 'test' ? passThrough : rateLimit({ windowMs: 60 * 1000, max: 120 });

const trackRoute = new Hono();

trackRoute.post('/', trackLimit, validateJson(visitSchema), async (c) => {
  const userAgent = c.req.header('user-agent') ?? '';
  if (isBot(userAgent)) return c.body(null, 204);

  const body = c.req.valid('json');
  const { source, host } = classifySource(body);
  await recordVisit({
    id: body.id,
    path: body.path,
    visitor: askVisitor(clientIp(c), userAgent),
    landing: body.landing,
    returning: body.returning,
    source,
    referrerHost: host,
    device: deviceFrom(userAgent),
    signedIn: body.signedIn,
  });
  return c.body(null, 204);
});

trackRoute.post('/depth', trackLimit, validateJson(depthSchema), async (c) => {
  const { id, depth } = c.req.valid('json');
  await saveReadDepth(id, depth);
  return c.body(null, 204);
});

export default trackRoute;