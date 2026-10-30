'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { AvianBotText } from '@/app/(dashboard)/assistant/text';
import { askQuestion, type AskSource, type AskTurn } from '@/lib/ask';
import AnswerText from './answer-text';
import AvianBot, { type AvianBotState } from './avian-bot';

type Status = 'thinking' | 'speaking' | 'done' | 'not_found' | 'error' | 'stopped';

type Message = {
  id: string;
  question: string;
  answer: string;
  status: Status;
  sources: AskSource[];
  cited: number[];
  errorCode?: string;
};

const ASK_PATH = '/api/assistant/ask';
const MAX_HISTORY = 3;
const MAX_QUESTION = 500;

let counter = 0;
const nextId = () => `a${Date.now().toString(36)}${(counter++).toString(36)}`;
const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
const editorHref = (source: AskSource) => (source.postId ? `/posts/${source.postId}` : '/posts');
const canRetry = (code?: string) => !code || code === 'provider_error' || code === 'network';

function errorMessage(text: AvianBotText, code?: string) {
  if (code === 'disabled') return text.errorDisabled;
  if (code === 'daily_limit') return text.errorDailyLimit;
  if (code === 'network') return text.errorNetwork;
  return text.errorProvider;
}

function Icon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

export default function AdminBot({ text }: { text: AvianBotText }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [happy, setHappy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const controller = useRef<AbortController | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const suggestions = text.suggestions
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  const last = messages.at(-1);
  const onEditor = /^\/posts\/[^/]+/.test(pathname);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const focus = setTimeout(() => field.current?.focus({ preventScroll: true }), 320);
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(focus);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  useEffect(() => {
    const element = thread.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  }, [input]);

  useEffect(() => () => controller.current?.abort(), []);

  function botState(message?: Message): AvianBotState {
    if (!message) return 'idle';
    if (message.status === 'thinking') return 'thinking';
    if (message.status === 'speaking') return 'speaking';
    return happy === message.id ? 'happy' : 'idle';
  }

  function update(id: string, change: Partial<Message> | ((message: Message) => Partial<Message>)) {
    setMessages((list) => list.map((message) => (message.id === id ? { ...message, ...(typeof change === 'function' ? change(message) : change) } : message)));
  }

  async function ask(raw: string) {
    const question = raw.trim().slice(0, MAX_QUESTION);
    if (busy || question.length < 3) return;

    const history: AskTurn[] = messages
      .filter((message) => message.status === 'done' && message.answer)
      .slice(-MAX_HISTORY)
      .map((message) => ({ question: message.question, answer: message.answer.slice(0, 4000) }));

    const id = nextId();
    setMessages((list) => [...list, { id, question, answer: '', status: 'thinking', sources: [], cited: [] }]);
    setInput('');
    setBusy(true);

    const current = new AbortController();
    controller.current = current;

    await askQuestion(
      ASK_PATH,
      question,
      history,
      {
        onSources: (sources) => update(id, { sources }),
        onDelta: (chunk) => update(id, (message) => ({ answer: message.answer + chunk, status: 'speaking' })),
        onDone: (done) => {
          update(id, { status: 'done', cited: done.cited });
          setHappy(id);
          setTimeout(() => setHappy((value) => (value === id ? null : value)), 2200);
        },
        onNotFound: () => update(id, { status: 'not_found' }),
        onError: (code) => update(id, { status: 'error', errorCode: code }),
      },
      current.signal,
    );

    if (current.signal.aborted) update(id, (message) => (message.status === 'done' ? {} : { status: 'stopped' }));
    if (controller.current === current) controller.current = null;
    setBusy(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    ask(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      ask(input);
    }
  }

  function retry(message: Message) {
    setMessages((list) => list.filter((item) => item.id !== message.id));
    setTimeout(() => ask(message.question), 0);
  }

  function newChat() {
    controller.current?.abort();
    setMessages([]);
    setInput('');
    field.current?.focus();
  }

  function onSourceClick() {
    if (isMobile()) close();
  }

  async function copy(message: Message) {
    try {
      await navigator.clipboard.writeText(message.answer.replace(/\s*\[\d{1,2}\]/g, '').trim());
      setCopied(message.id);
      setTimeout(() => setCopied((value) => (value === message.id ? null : value)), 1500);
    } catch {}
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={text.button}
        title={text.button}
        onClick={() => {
          setStarted(true);
          setOpen(true);
        }}
        className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 rounded-full bg-[#0f172a] p-1 shadow-[0_10px_30px_rgb(15_23_42/0.28)] ring-1 ring-[#ffffff]/10 transition-[transform,opacity] duration-200 active:scale-95 md:bottom-6 md:right-6 ${
          open ? 'pointer-events-none scale-90 opacity-0' : ''
        } ${onEditor ? 'max-md:hidden' : ''}`}
      >
        <AvianBot size={44} />
      </button>

      {started && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            onClick={close}
            aria-hidden
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="avian-bot-title"
            data-open={open}
            inert={!open}
            className="ask-panel fixed inset-0 z-50 flex flex-col bg-white md:inset-y-3 md:left-auto md:right-3 md:w-[400px] md:rounded-2xl md:shadow-2xl md:ring-1 md:ring-zinc-200"
          >
            <header className="flex items-center gap-2.5 border-b border-zinc-200 px-3 pb-2.5 pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-3">
              <span className="pt-1.5">
                <AvianBot state={botState(last)} size={34} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="avian-bot-title" className="text-[15px] font-semibold text-zinc-900">
                  {text.title}
                </h2>
                <p className="truncate text-xs text-zinc-500">{text.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={newChat}
                aria-label={text.newChat}
                title={text.newChat}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100"
              >
                <Icon path="M12 5v14M5 12h14" />
              </button>
              <button
                type="button"
                onClick={close}
                aria-label={text.close}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100"
              >
                <Icon path="M6 6l12 12M18 6 6 18" />
              </button>
            </header>

            <div ref={thread} className="flex-1 overflow-y-auto overscroll-contain px-3.5 py-4">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2.5">
                    <span className="shrink-0 pt-1.5">
                      <AvianBot state="happy" size={32} label={text.botLabel} />
                    </span>
                    <p className="rounded-2xl rounded-tl-md bg-teal-50 px-3.5 py-2.5 text-[15px] text-zinc-800 ring-1 ring-teal-100">{text.welcome}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 pl-[42px]">
                    {suggestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => ask(question)}
                        className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-left text-sm text-zinc-800 hover:border-teal-200 hover:bg-teal-50"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ol className="flex flex-col gap-4">
                  {messages.map((message) => {
                    const isLast = message.id === last?.id;
                    const shown = message.cited.length ? message.sources.filter((source) => message.cited.includes(source.n)) : [];
                    return (
                      <li key={message.id} className="flex flex-col gap-3">
                        <p className="ask-rise max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-zinc-900 px-3.5 py-2.5 text-white">
                          {message.question}
                        </p>
                        <div className="ask-rise flex items-start gap-2.5">
                          <span className="shrink-0 pt-1.5">
                            <AvianBot state={isLast ? botState(message) : 'idle'} size={32} bubble={isLast} />
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                            {message.status === 'thinking' && (
                              <p className="flex h-9 items-center gap-2 text-sm text-zinc-500">
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" aria-hidden />
                                {text.thinking}
                              </p>
                            )}

                            {message.answer && (
                              <div className="rounded-2xl rounded-tl-md bg-teal-50 px-3.5 py-2.5 text-[15px] leading-relaxed text-zinc-800 ring-1 ring-teal-100">
                                <AnswerText
                                  text={message.answer}
                                  sources={message.sources}
                                  streaming={message.status === 'speaking'}
                                  citeLabel={text.citeLabel}
                                  hrefFor={editorHref}
                                  onSourceClick={onSourceClick}
                                />
                                {message.status === 'stopped' && <p className="mt-2 text-xs text-zinc-500">{text.stopped}</p>}
                              </div>
                            )}

                            {message.status === 'stopped' && !message.answer && <p className="text-sm text-zinc-500">{text.stopped}</p>}

                            {message.status === 'not_found' && (
                              <p className="rounded-2xl rounded-tl-md border border-dashed border-zinc-300 px-3.5 py-3 text-[15px] text-zinc-700">{text.notFound}</p>
                            )}

                            {message.status === 'error' && (
                              <div className="rounded-2xl rounded-tl-md bg-amber-50 px-3.5 py-3 text-[15px] text-amber-900 ring-1 ring-amber-200">
                                <p>{errorMessage(text, message.errorCode)}</p>
                                {canRetry(message.errorCode) && (
                                  <button
                                    type="button"
                                    onClick={() => retry(message)}
                                    disabled={busy}
                                    className="mt-2.5 inline-flex h-9 items-center rounded-full bg-white px-3.5 text-sm font-medium ring-1 ring-amber-200 hover:bg-amber-100"
                                  >
                                    {text.tryAgain}
                                  </button>
                                )}
                              </div>
                            )}

                            {message.status === 'done' && shown.length > 0 && (
                              <div className="flex flex-col gap-1.5">
                                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{text.sourcesTitle}</h3>
                                {shown.map((source) => (
                                  <Link
                                    key={source.url}
                                    href={editorHref(source)}
                                    onClick={onSourceClick}
                                    className="flex items-center gap-2.5 rounded-xl border border-zinc-200 px-2.5 py-2 hover:bg-zinc-50"
                                  >
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-700">
                                      {source.n}
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col">
                                      <span className="truncate text-sm font-medium text-zinc-900">{source.postTitle}</span>
                                      <span className="truncate text-xs text-zinc-500">{source.heading || text.introduction}</span>
                                    </span>
                                    {source.published === false && (
                                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{text.draft}</span>
                                    )}
                                  </Link>
                                ))}
                              </div>
                            )}

                            {message.status === 'done' && (
                              <button type="button" onClick={() => copy(message)} className="h-8 self-start rounded-lg px-2 text-sm text-zinc-500 hover:bg-zinc-100">
                                {copied === message.id ? text.copied : text.copy}
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="border-t border-zinc-200 px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5">
              <form
                onSubmit={onSubmit}
                className="flex items-end gap-2 rounded-[1.25rem] border border-transparent bg-zinc-100 py-1.5 pl-3.5 pr-1.5 focus-within:border-teal-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-100"
              >
                <label htmlFor="ask-input" className="sr-only">
                  {text.inputLabel}
                </label>
                <textarea
                  id="ask-input"
                  ref={field}
                  rows={1}
                  value={input}
                  maxLength={MAX_QUESTION}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={text.placeholder}
                  enterKeyHint="send"
                  className="max-h-32 min-w-0 flex-1 resize-none bg-transparent py-2 text-base leading-snug text-zinc-900 outline-none placeholder:text-zinc-500"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={() => controller.current?.abort()}
                    aria-label={text.stop}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white"
                  >
                    <span className="h-3 w-3 rounded-sm bg-white" aria-hidden />
                  </button>
                ) : (
                  <button
                    type="submit"
                    aria-label={text.send}
                    disabled={input.trim().length < 3}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-opacity disabled:opacity-30"
                  >
                    <Icon size={18} path="M12 19V5M5 12l7-7 7 7" />
                  </button>
                )}
              </form>
            </div>
          </section>
        </>
      )}
    </>
  );
}