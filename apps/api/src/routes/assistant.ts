import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { adminOverview, asksToday, findSources, getAssistantSettings, logAsk, saveAssistantSettings } from '../data/ask.js';
import type { SearchScope } from '../data/search.js';
import { AiError, hasKey, PROVIDER_IDS, PROVIDERS, testConnection, WORDS } from '../lib/ai/providers.js';
import { buildAdminSystemPrompt } from '../lib/ask-prompt.js';
import { askSchema, streamAsk, toMessages } from '../lib/ask-stream.js';
import { validateJson } from '../lib/validate.js';
import { requireAuth, requireRole, type AuthEnv } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

const isProduction = process.env.NODE_ENV === 'production';
const availableProviders = PROVIDER_IDS.filter((id) => id !== 'pretend' || !isProduction);

const passThrough = createMiddleware(async (_c, next) => next());
const staffAskLimit = process.env.NODE_ENV === 'test' ? passThrough : rateLimit({ windowMs: 60 * 1000, max: 15 });

const settingsSchema = z
  .object({
    enabled: z.boolean(),
    adminEnabled: z.boolean(),
    provider: z.enum(PROVIDER_IDS as [string, ...string[]]),
    model: z.string().trim().min(1, 'Enter a model name').max(100),
    baseUrl: z.union([z.literal(''), z.string().trim().url('Enter a full URL').startsWith('https://', 'Use an https:// URL').max(300)]),
    dailyLimit: z.number().int().min(0).max(100_000),
    perReaderLimit: z.number().int().min(1).max(1000),
    answerLength: z.enum(['short', 'medium', 'long']),
    creativity: z.number().int().min(0).max(10),
  })
  .refine((value) => value.provider !== 'pretend' || !isProduction, { message: 'Pick a real provider', path: ['provider'] })
  .refine((value) => value.provider !== 'custom' || value.baseUrl !== '', { message: 'Add the base URL for this provider', path: ['baseUrl'] });

type SettingsInput = z.infer<typeof settingsSchema>;
type ProviderId = (typeof PROVIDER_IDS)[number];
const asConfig = (value: SettingsInput) => ({ ...value, provider: value.provider as ProviderId });

const missingKey = (provider: ProviderId) => `Add ${PROVIDERS[provider].keyEnv} to apps/api/.env and restart the API first`;

const assistantRoute = new Hono<AuthEnv>();
assistantRoute.use('/settings', requireAuth, requireRole('super_admin'));
assistantRoute.use('/test', requireAuth, requireRole('super_admin'));
assistantRoute.use('/config', requireAuth);
assistantRoute.use('/ask', requireAuth);

const isStaff = (role: string) => role === 'admin' || role === 'super_admin';

assistantRoute.get('/settings', async (c) => {
  return c.json({
    settings: await getAssistantSettings(),
    providers: availableProviders.map((id) => ({
      id,
      label: PROVIDERS[id].label,
      keyEnv: PROVIDERS[id].keyEnv,
      keySet: hasKey(id),
      models: PROVIDERS[id].models,
      needsBaseUrl: id === 'custom',
    })),
  });
});

assistantRoute.put('/settings', validateJson(settingsSchema), async (c) => {
  const value = asConfig(c.req.valid('json'));
  if ((value.enabled || value.adminEnabled) && !hasKey(value.provider)) return c.json({ error: missingKey(value.provider) }, 400);
  await saveAssistantSettings(value, c.get('user').id);
  return c.json({ settings: await getAssistantSettings() });
});

assistantRoute.post('/test', validateJson(settingsSchema), async (c) => {
  const value = asConfig(c.req.valid('json'));
  if (!hasKey(value.provider)) return c.json({ ok: false, error: missingKey(value.provider) });
  try {
    return c.json({ ok: true, ...(await testConnection(value)) });
  } catch (error) {
    return c.json({ ok: false, error: error instanceof AiError ? error.message : 'Could not reach the provider' });
  }
});

assistantRoute.get('/config', async (c) => {
  if (!isStaff(c.get('user').role)) return c.json({ enabled: false });
  const settings = await getAssistantSettings();
  return c.json({ enabled: settings.adminEnabled });
});

assistantRoute.post('/ask', staffAskLimit, validateJson(askSchema), async (c) => {
  const user = c.get('user');
  if (!isStaff(user.role)) return c.json({ error: 'Not allowed', code: 'forbidden' }, 403);

  const settings = await getAssistantSettings();
  if (!settings.adminEnabled) return c.json({ error: 'Avian bot is turned off in admin', code: 'disabled' }, 503);

  const visitor = `staff-${user.id}`;
  const today = await asksToday(visitor);
  if (today.total >= settings.dailyLimit) return c.json({ error: 'Daily limit reached', code: 'daily_limit' }, 429);

  const scope: SearchScope = user.role === 'super_admin' ? { includeDrafts: true } : { includeDrafts: true, authorId: user.id };
  const { question, history = [] } = c.req.valid('json');
  const lastQuestion = history.at(-1)?.question;
  let sources = await findSources(question, scope);
  if (sources.length === 0 && lastQuestion) sources = await findSources(`${lastQuestion} ${question}`, scope);
  const overview = await adminOverview(scope);

  const id = randomUUID();
  return streamAsk(c, {
    id,
    settings,
    system: buildAdminSystemPrompt(sources, overview, WORDS[settings.answerLength]),
    messages: toMessages(history, question),
    sources,
    requireSources: false,
    log: (status) =>
      logAsk({
        id,
        question,
        visitor,
        status,
        sourceCount: sources.length,
        provider: settings.provider,
        model: settings.model,
        audience: 'staff',
      }),
  });
});

export default assistantRoute;