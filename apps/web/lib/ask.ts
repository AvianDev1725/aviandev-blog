export type AskSource = { n: number; url: string; postTitle: string; heading: string; postId?: number; published?: boolean };
export type AskTurn = { question: string; answer: string };
export type AskConfig = { enabled: boolean; remaining: number };
export type AskDone = { id: string; cited: number[]; followUps: string[] };

export type AskHandlers = {
  onSources: (sources: AskSource[]) => void;
  onDelta: (text: string) => void;
  onDone: (done: AskDone) => void;
  onNotFound: (result: { id: string }) => void;
  onError: (code: string) => void;
};

const OFF: AskConfig = { enabled: false, remaining: 0 };

export async function getAskConfig(): Promise<AskConfig> {
  try {
    const res = await fetch('/api/ask/config', { cache: 'no-store' });
    return res.ok ? ((await res.json()) as AskConfig) : OFF;
  } catch {
    return OFF;
  }
}

function parseEvent(block: string) {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')) };
  } catch {
    return null;
  }
}

/** Sends a question and calls the handlers as the answer streams in. */
export async function askQuestion(
  path: string,
  question: string,
  history: AskTurn[],
  handlers: AskHandlers,
  signal: AbortSignal,
) {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
      signal,
    });
  } catch {
    if (!signal.aborted) handlers.onError('network');
    return;
  }

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    handlers.onError(typeof body?.code === 'string' ? body.code : 'provider_error');
    return;
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let finished = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value.replace(/\r/g, '');
      let index: number;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const parsed = parseEvent(buffer.slice(0, index));
        buffer = buffer.slice(index + 2);
        if (!parsed) continue;
        const { event, data } = parsed;
        if (event === 'sources') handlers.onSources(data);
        else if (event === 'delta') handlers.onDelta(String(data.text ?? ''));
        else if (event === 'done') {
          finished = true;
          handlers.onDone(data);
        } else if (event === 'not_found') {
          finished = true;
          handlers.onNotFound(data);
        } else if (event === 'error') {
          finished = true;
          handlers.onError(String(data.code ?? 'provider_error'));
        }
      }
    }
  } catch {
    if (signal.aborted) return;
  }

  if (!finished && !signal.aborted) handlers.onError('network');
}

export function sendFeedback(path: string, id: string, helpful: boolean) {
  fetch(`${path}/${id}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ helpful }),
    keepalive: true,
  }).catch(() => {});
}