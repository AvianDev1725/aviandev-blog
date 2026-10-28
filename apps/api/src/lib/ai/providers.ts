export type AnswerLength = 'short' | 'medium' | 'long';
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

type Provider = {
  label: string;
  kind: 'openai' | 'anthropic' | 'pretend';
  baseUrl: string;
  keyEnv: string | null;
  models: string[];
};

export const PROVIDERS = {
  groq: {
    label: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
  },
  gemini: {
    label: 'Google Gemini',
    kind: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    models: [],
  },
  openrouter: {
    label: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    models: [],
  },
  anthropic: {
    label: 'Anthropic Claude',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyEnv: 'ANTHROPIC_API_KEY',
    models: ['claude-haiku-5-5', 'claude-sonnet-5-5'],
  },
  custom: {
    label: 'Other OpenAI-compatible',
    kind: 'openai',
    baseUrl: '',
    keyEnv: 'CUSTOM_AI_API_KEY',
    models: [],
  },
  pretend: {
    label: 'Pretend (for testing)',
    kind: 'pretend',
    baseUrl: '',
    keyEnv: null,
    models: ['pretend'],
  },
} satisfies Record<string, Provider>;

export type ProviderId = keyof typeof PROVIDERS;
export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export const MAX_TOKENS: Record<AnswerLength, number> = { short: 350, medium: 700, long: 1200 };
export const WORDS: Record<AnswerLength, number> = { short: 120, medium: 250, long: 450 };

export type AiSettings = {
  provider: ProviderId;
  model: string;
  baseUrl: string;
  answerLength: AnswerLength;
  creativity: number;
};

export class AiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export function hasKey(id: ProviderId) {
  const env = PROVIDERS[id].keyEnv;
  return env === null || Boolean(process.env[env]?.trim());
}

function apiKey(id: ProviderId) {
  const env = PROVIDERS[id].keyEnv;
  if (!env) return '';
  const key = process.env[env]?.trim();
  if (!key) throw new AiError(`${env} is not set`);
  return key;
}

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function* sseData(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let index: number;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
}

async function check(res: Response, label: string) {
  if (res.ok) return;
  const body = parseJson(await res.text().catch(() => ''));
  const detail = body?.error?.message ?? body?.message ?? '';
  throw new AiError(`${label} replied ${res.status}${detail ? `: ${String(detail).slice(0, 200)}` : ''}`, res.status);
}

async function* pretendAnswer(messages: ChatMessage[]) {
  const text = messages.some((message) => message.content.includes('pretend-not-found'))
    ? 'NOT_FOUND'
    : 'A timeline lines up tweens one after another [1]. You can play, pause and reverse it as one animation [1].';
  for (const word of text.split(/(?<= )/)) yield word;
}

export async function* streamAnswer(
  settings: AiSettings,
  input: { system: string; messages: ChatMessage[]; maxTokens?: number },
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const provider: Provider = PROVIDERS[settings.provider];
  const maxTokens = input.maxTokens ?? MAX_TOKENS[settings.answerLength];
  const temperature = Math.min(Math.max(settings.creativity, 0), 10) / 10;

  if (provider.kind === 'pretend') {
    yield* pretendAnswer(input.messages);
    return;
  }

  const key = apiKey(settings.provider);

  if (provider.kind === 'anthropic') {
    const res = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: settings.model,
        system: input.system,
        messages: input.messages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      }),
    });
    await check(res, provider.label);
    for await (const data of sseData(res)) {
      const event = parseJson(data);
      if (event?.type === 'error') throw new AiError(`${provider.label}: ${event.error?.message ?? 'error'}`);
      if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') yield event.delta.text as string;
    }
    return;
  }

  const base = (settings.provider === 'custom' ? settings.baseUrl : provider.baseUrl).replace(/\/+$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: 'system', content: input.system }, ...input.messages],
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
  });
  await check(res, provider.label);
  for await (const data of sseData(res)) {
    if (data === '[DONE]') return;
    const text = parseJson(data)?.choices?.[0]?.delta?.content;
    if (typeof text === 'string' && text) yield text;
  }
}

export async function testConnection(settings: AiSettings) {
  const started = Date.now();
  let reply = '';
  for await (const text of streamAnswer(settings, {
    system: 'Reply with the single word OK.',
    messages: [{ role: 'user', content: 'Say OK.' }],
    maxTokens: 10,
  })) {
    reply += text;
  }
  return { ms: Date.now() - started, reply: reply.trim().slice(0, 40) };
}