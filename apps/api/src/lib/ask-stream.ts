import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { streamAnswer, type AiSettings, type ChatMessage } from './ai/providers.js';
import { citedNumbers, followUpTopics, NOT_FOUND, type AskSource } from './ask-prompt.js';

export type AskStatus = 'answered' | 'not_found' | 'error';

export const askSchema = z.object({
  question: z.string().trim().min(3, 'Ask a slightly longer question').max(500, 'Questions can be up to 500 characters'),
  history: z
    .array(z.object({ question: z.string().trim().max(500), answer: z.string().max(4000) }))
    .max(3)
    .optional(),
});

export function toMessages(history: { question: string; answer: string }[], question: string): ChatMessage[] {
  return [
    ...history.flatMap((turn): ChatMessage[] => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer },
    ]),
    { role: 'user', content: question },
  ];
}

const withoutContent = ({ content: _content, ...source }: AskSource) => source;

export function streamAsk(
  c: Context<any>,
  options: {
    id: string;
    settings: AiSettings;
    system: string;
    messages: ChatMessage[];
    sources: AskSource[];
    /** Readers: answer "not found" without calling the model when no sections match. */
    requireSources: boolean;
    log: (status: AskStatus) => Promise<unknown>;
  },
) {
  const { id, settings, system, messages, sources, requireSources, log } = options;

  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());

    let status: AskStatus = 'answered';
    let answer = '';
    const send = (event: string, data: unknown) => stream.writeSSE({ event, data: JSON.stringify(data) });

    try {
      if (requireSources && sources.length === 0) {
        status = 'not_found';
        await send('not_found', { id });
        return;
      }

      await send('sources', sources.map(withoutContent));

      let held = '';
      let streaming = false;

      for await (const text of streamAnswer(settings, { system, messages }, controller.signal)) {
        answer += text;
        if (streaming) {
          await send('delta', { text });
          continue;
        }
        held += text;
        const start = held.trimStart();
        if (start.length < NOT_FOUND.length && NOT_FOUND.startsWith(start)) continue;
        if (start.startsWith(NOT_FOUND)) break;
        streaming = true;
        await send('delta', { text: held });
      }

      if (answer.trimStart().startsWith(NOT_FOUND)) {
        status = 'not_found';
        await send('not_found', { id });
        return;
      }
      if (!streaming && held) await send('delta', { text: held });

      const cited = citedNumbers(answer, sources.length);
      await send('done', { id, cited, followUps: followUpTopics(sources, cited) });
    } catch (error) {
      if (controller.signal.aborted) return;
      status = 'error';
      console.error('Ask failed:', error instanceof Error ? error.message : error);
      await send('error', { code: 'provider_error' });
    } finally {
      await log(status).catch(() => {});
    }
  });
}