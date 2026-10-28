import { randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { askVisitor, asksToday, findSources, getAssistantSettings, logAsk, saveFeedback } from '../data/ask.js';
import { WORDS } from '../lib/ai/providers.js';
import { buildSystemPrompt } from '../lib/ask-prompt.js';
import { askSchema, streamAsk, toMessages } from '../lib/ask-stream.js';
import { validateJson } from '../lib/validate.js';
import { isBot } from '../lib/views.js';
import { rateLimit } from '../middleware/rate-limit.js';

const feedbackSchema = z.object({ helpful: z.boolean() });

const passThrough = createMiddleware(async (_c, next) => next());
const askLimit = process.env.NODE_ENV === 'test' ? passThrough : rateLimit({ windowMs: 60 * 1000, max: 10 });
const feedbackLimit = process.env.NODE_ENV === 'test' ? passThrough : rateLimit({ windowMs: 60 * 1000, max: 30 });

function clientIp(c: Context) {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
}

const askRoute = new Hono();

askRoute.get('/config', async (c) => {
  c.header('Cache-Control', 'no-store');
  const settings = await getAssistantSettings();
  if (!settings.enabled) return c.json({ enabled: false, remaining: 0 });

  const visitor = askVisitor(clientIp(c), c.req.header('user-agent') ?? '');
  const today = await asksToday(visitor);
  const remaining = Math.max(0, Math.min(settings.perReaderLimit - today.mine, settings.dailyLimit - today.total));
  return c.json({ enabled: true, remaining });
});

askRoute.post('/', askLimit, validateJson(askSchema), async (c) => {
  const userAgent = c.req.header('user-agent') ?? '';
  if (isBot(userAgent)) return c.json({ error: 'Not available', code: 'bot' }, 403);

  const settings = await getAssistantSettings();
  if (!settings.enabled) return c.json({ error: 'Ask AvianDev is turned off', code: 'disabled' }, 503);

  const visitor = askVisitor(clientIp(c), userAgent);
  const today = await asksToday(visitor);
  if (today.total >= settings.dailyLimit) return c.json({ error: 'Daily limit reached', code: 'daily_limit' }, 429);
  if (today.mine >= settings.perReaderLimit) return c.json({ error: 'Reader limit reached', code: 'reader_limit' }, 429);

  const { question, history = [] } = c.req.valid('json');
  const lastQuestion = history.at(-1)?.question;
  let sources = await findSources(question);
  if (sources.length === 0 && lastQuestion) sources = await findSources(`${lastQuestion} ${question}`);

  const id = randomUUID();
  return streamAsk(c, {
    id,
    settings,
    system: buildSystemPrompt(sources, WORDS[settings.answerLength]),
    messages: toMessages(history, question),
    sources,
    requireSources: true,
    log: (status) =>
      logAsk({ id, question, visitor, status, sourceCount: sources.length, provider: settings.provider, model: settings.model }),
  });
});

askRoute.post('/:id/feedback', feedbackLimit, validateJson(feedbackSchema), async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: 'Answer not found' }, 404);
  const saved = await saveFeedback(id, c.req.valid('json').helpful);
  return saved ? c.body(null, 204) : c.json({ error: 'Answer not found' }, 404);
});

export default askRoute;