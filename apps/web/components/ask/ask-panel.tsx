'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { fill } from '@aviandev/core/text';
import type { AskText } from '@/app/text';
import { askQuestion, sendFeedback, type AskSource, type AskTurn } from '@/lib/ask';
import AnswerText from './answer-text';
import AvianBot, { type AvianBotState } from './avian-bot';

type Status = 'searching' | 'reading' | 'speaking' | 'done' | 'not_found' | 'error' | 'stopped';

type Message = {
  id: string;
  question: string;
  answer: string;
  status: Status;
  sources: AskSource[];
  cited: number[];
  followUps: string[];
  askId?: string;
  errorCode?: string;
  feedback?: boolean;
};

type Props = { text: AskText; open: boolean; remaining: number; onClose: () => void };

const ASK_PATH = '/api/ask';
const MAX_HISTORY = 3;
const MAX_QUESTION = 500;
const HAPPY_MS = 2200;

let counter = 0;
const nextId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;
const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
const canRetry = (code?: string) => !code || code === 'provider_error' || code === 'network';

function errorMessage(text: AskText, code?: string) {
  if (code === 'disabled') return text.errorDisabled;
  if (code === 'daily_limit') return text.errorDailyLimit;
  if (code === 'reader_limit') return text.errorReaderLimit;
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

export default function AskPanel({ text, open, remaining: initialRemaining, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [happy, setHappy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const controller = useRef<AbortController | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const followBottom = useRef(true);

  const suggestions = text.suggestions
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  const last = messages.at(-1);
  const trimmed = input.trim();
  const outOfQuestions = remaining <= 0;

  function botState(message?: Message): AvianBotState {
    if (!message) return 'idle';
    if (message.status === 'searching' || message.status === 'reading') return 'thinking';
    if (message.status === 'speaking') return 'speaking';
    return happy === message.id ? 'happy' : 'idle';
  }

  useEffect(() => {
    if (!open) return;
    const focus = setTimeout(() => field.current?.focus({ preventScroll: true }), 320);
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    let previousOverflow = '';
    const lock = isMobile();
    if (lock) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      clearTimeout(focus);
      window.removeEventListener('keydown', onKey);
      if (lock) document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    const element = thread.current;
    if (element && followBottom.current) element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  }, [input]);

  useEffect(() => () => controller.current?.abort(), []);

  function update(id: string, change: Partial<Message> | ((message: Message) => Partial<Message>)) {
    setMessages((list) => list.map((message) => (message.id === id ? { ...message, ...(typeof change === 'function' ? change(message) : change) } : message)));
  }

  async function ask(raw: string) {
    const question = raw.trim().slice(0, MAX_QUESTION);
    if (busy || question.length < 3 || outOfQuestions) return;

    const history: AskTurn[] = messages
      .filter((message) => message.status === 'done' && message.answer)
      .slice(-MAX_HISTORY)
      .map((message) => ({ question: message.question, answer: message.answer.slice(0, 4000) }));

    const id = nextId();
    setMessages((list) => [...list, { id, question, answer: '', status: 'searching', sources: [], cited: [], followUps: [] }]);
    setInput('');
    setBusy(true);
    setRemaining((count) => count - 1);
    setAnnouncement(text.searching);
    followBottom.current = true;

    const current = new AbortController();
    controller.current = current;

    await askQuestion(
      ASK_PATH,
      question,
      history,
      {
        onSources: (sources) => {
          update(id, { sources, status: 'reading' });
          setAnnouncement(sources.length === 1 ? text.readingOne : fill(text.readingMany, { count: String(sources.length) }));
        },
        onDelta: (chunk) => update(id, (message) => ({ answer: message.answer + chunk, status: 'speaking' })),
        onDone: (done) => {
          update(id, { status: 'done', askId: done.id, cited: done.cited, followUps: done.followUps });
          setAnnouncement(text.answerReady);
          setHappy(id);
          setTimeout(() => setHappy((value) => (value === id ? null : value)), HAPPY_MS);
        },
        onNotFound: (result) => {
          update(id, { status: 'not_found', askId: result.id });
          setAnnouncement(text.notFound);
        },
        onError: (code) => {
          update(id, { status: 'error', errorCode: code });
          setAnnouncement(errorMessage(text, code));
          if (code === 'reader_limit' || code === 'daily_limit') setRemaining(0);
          else if (canRetry(code)) setRemaining((count) => count + 1);
        },
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
    if (isMobile()) onClose();
  }

  function giveFeedback(message: Message, helpful: boolean) {
    if (!message.askId || message.feedback !== undefined) return;
    sendFeedback(ASK_PATH, message.askId, helpful);
    update(message.id, { feedback: helpful });
    setAnnouncement(text.thanks);
  }

  async function copy(message: Message) {
    try {
      await navigator.clipboard.writeText(message.answer.replace(/\s*\[\d{1,2}\]/g, '').trim());
      setCopied(message.id);
      setTimeout(() => setCopied((value) => (value === message.id ? null : value)), 1500);
    } catch {}
  }

  function onScroll() {
    const element = thread.current;
    if (element) followBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  }

  const chip =
    'rounded-full border px-3.5 py-2 text-left text-sm transition-colors active:scale-[0.98] disabled:opacity-50';

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-zinc-900/30 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-title"
        data-open={open}
        inert={!open}
        className="ask-panel fixed inset-0 z-50 flex flex-col bg-white md:inset-y-3 md:left-auto md:right-3 md:w-[420px] md:rounded-2xl md:shadow-2xl md:ring-1 md:ring-zinc-200"
      >
        <header className="flex items-center gap-2.5 border-b border-zinc-200 px-3 pb-2.5 pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-3">
          <span className="pt-1.5">
            <AvianBot state={botState(last)} size={36} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="ask-title" className="text-[15px] font-semibold text-zinc-900">
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
            onClick={onClose}
            aria-label={text.close}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100"
          >
            <Icon path="M6 6l12 12M18 6 6 18" />
          </button>
        </header>

        <div ref={thread} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain px-3.5 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center px-2 pt-6 text-center">
              <AvianBot state="happy" size={104} label={text.botLabel} />
              <h3 className="mt-4 text-xl font-semibold text-zinc-900">{text.welcomeTitle}</h3>
              <p className="mt-1.5 max-w-xs text-zinc-500">{text.welcomeBody}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {suggestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={outOfQuestions}
                    onClick={() => ask(question)}
                    className={`${chip} border-zinc-200 bg-white text-zinc-800 hover:border-teal-200 hover:bg-teal-50`}
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
                const shown = message.cited.length
                  ? message.sources.filter((source) => message.cited.includes(source.n))
                  : message.sources.slice(0, 3);
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
                        {(message.status === 'searching' || message.status === 'reading') && (
                          <p className="flex h-9 items-center gap-2 text-sm text-zinc-500">
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" aria-hidden />
                            {message.status === 'searching'
                              ? text.searching
                              : message.sources.length === 1
                                ? text.readingOne
                                : fill(text.readingMany, { count: String(message.sources.length) })}
                          </p>
                        )}

                        {message.answer && (
                          <div className="rounded-2xl rounded-tl-md bg-teal-50 px-3.5 py-2.5 text-[15px] leading-relaxed text-zinc-800 ring-1 ring-teal-100">
                            <AnswerText
                              text={message.answer}
                              sources={message.sources}
                              streaming={message.status === 'speaking'}
                              citeLabel={text.citeLabel}
                              onSourceClick={onSourceClick}
                            />
                            {message.status === 'stopped' && <p className="mt-2 text-xs text-zinc-500">{text.stopped}</p>}
                          </div>
                        )}

                        {message.status === 'stopped' && !message.answer && <p className="text-sm text-zinc-500">{text.stopped}</p>}

                        {message.status === 'not_found' && (
                          <div className="rounded-2xl rounded-tl-md border border-dashed border-zinc-300 px-3.5 py-3 text-[15px] text-zinc-700">
                            <p>{text.notFound}</p>
                            <Link
                              href={`/search?q=${encodeURIComponent(message.question)}`}
                              onClick={onSourceClick}
                              className="mt-3 inline-flex h-9 items-center rounded-full border border-zinc-200 px-3.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                            >
                              {text.searchInstead}
                            </Link>
                          </div>
                        )}

                        {message.status === 'error' && (
                          <div className="rounded-2xl rounded-tl-md bg-amber-50 px-3.5 py-3 text-[15px] text-amber-900 ring-1 ring-amber-200">
                            <p>{errorMessage(text, message.errorCode)}</p>
                            {canRetry(message.errorCode) && (
                              <button
                                type="button"
                                onClick={() => retry(message)}
                                disabled={busy}
                                className="mt-2.5 inline-flex h-9 items-center rounded-full bg-white px-3.5 text-sm font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                              >
                                {text.tryAgain}
                              </button>
                            )}
                          </div>
                        )}

                        {message.status === 'done' && shown.length > 0 && (
                          <div className="ask-rise flex flex-col gap-1.5">
                            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{text.sourcesTitle}</h4>
                            {shown.map((source) => (
                              <Link
                                key={source.url}
                                href={source.url}
                                onClick={onSourceClick}
                                className="flex items-center gap-2.5 rounded-xl border border-zinc-200 px-2.5 py-2 hover:bg-zinc-50"
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-700">
                                  {source.n}
                                </span>
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate text-sm font-medium text-zinc-900">{source.heading || text.introduction}</span>
                                  <span className="truncate text-xs text-zinc-500">{source.postTitle}</span>
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}

                        {message.status === 'done' && (
                          <div className="flex items-center gap-1 text-sm text-zinc-500">
                            <button
                              type="button"
                              onClick={() => giveFeedback(message, true)}
                              aria-label={text.helpful}
                              aria-pressed={message.feedback === true}
                              disabled={message.feedback !== undefined}
                              className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-100 ${message.feedback === true ? 'bg-teal-50 text-teal-700' : ''}`}
                            >
                              <Icon size={18} path="M7 10v11M15 5.9 14 10h5.5a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.1 21H7V10l4.6-7.3A1.6 1.6 0 0 1 14.6 4z" />
                            </button>
                            <button
                              type="button"
                              onClick={() => giveFeedback(message, false)}
                              aria-label={text.notHelpful}
                              aria-pressed={message.feedback === false}
                              disabled={message.feedback !== undefined}
                              className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-100 ${message.feedback === false ? 'bg-zinc-100 text-zinc-900' : ''}`}
                            >
                              <Icon size={18} path="M17 14V3M9 18.1 10 14H4.5a2 2 0 0 1-2-2.3l1.4-7A2 2 0 0 1 5.9 3H17v11l-4.6 7.3A1.6 1.6 0 0 1 9.4 20z" />
                            </button>
                            <button type="button" onClick={() => copy(message)} className="h-9 rounded-lg px-2.5 hover:bg-zinc-100">
                              {copied === message.id ? text.copied : text.copy}
                            </button>
                            {message.feedback !== undefined && <span className="ml-1 text-xs text-zinc-500">{text.thanks}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {isLast && message.status === 'done' && message.followUps.length > 0 && (
                      <div className="ask-rise flex flex-col gap-2 pl-[42px]">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{text.followUpsTitle}</h4>
                        <div className="flex flex-wrap gap-2">
                          {message.followUps.map((topic) => {
                            const question = fill(text.followUp, { topic });
                            return (
                              <button
                                key={topic}
                                type="button"
                                disabled={busy || outOfQuestions}
                                onClick={() => ask(question)}
                                className={`${chip} border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100`}
                              >
                                {question}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="border-t border-zinc-200 px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5">
          {remaining <= 3 && (
            <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              {outOfQuestions
                ? text.errorReaderLimit
                : remaining === 1
                  ? text.remainingOne
                  : fill(text.remainingMany, { count: String(remaining) })}
            </p>
          )}
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
              disabled={outOfQuestions}
              enterKeyHint="send"
              className="max-h-32 min-w-0 flex-1 resize-none bg-transparent py-2 text-base leading-snug text-zinc-900 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed"
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
                disabled={trimmed.length < 3 || outOfQuestions}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-opacity disabled:opacity-30"
              >
                <Icon size={18} path="M12 19V5M5 12l7-7 7 7" />
              </button>
            )}
          </form>
          <p className="mt-1.5 text-center text-[11.5px] text-zinc-500">{text.disclaimer}</p>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </section>
    </>
  );
}