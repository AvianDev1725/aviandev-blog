'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { fill, formatCount } from '@aviandev/core/text';
import type { SearchText } from '@/app/text';
import type { SearchResponse, SearchResult as Result, SearchTopic } from '@/lib/search';
import SearchResult from './search-result';

const RECENT_KEY = 'aviandev-recent-searches';
const DEBOUNCE_MS = 180;

function readRecent(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  try {
    const next = [query, ...readRecent().filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)));
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="shrink-0 text-zinc-400">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

type Props = { text: SearchText; icon?: string };

export default function SearchBox({ text, icon }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const desktopInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);

  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('');
  const [topics, setTopics] = useState<SearchTopic[]>([]);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  const open = desktopOpen || mobileOpen;
  const trimmed = query.trim();
  const showingSuggestions = Boolean(data && data.results.length === 0);
  const items: Result[] = data ? (showingSuggestions ? data.suggestions : data.results) : [];
  const hasOptions = open && items.length > 0;

  function close() {
    setDesktopOpen(false);
    setMobileOpen(false);
  }

  useEffect(() => {
    setDesktopOpen(false);
    setMobileOpen(false);
    setQuery('');
  }, [pathname]);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  useEffect(() => {
    if (!open || trimmed.length < 2) {
      setData(null);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed, limit: '8' });
        if (topic) params.set('topic', topic);
        const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const next: SearchResponse = await res.json();
        setData(next);
        if (!topic) setTopics(next.topics);
        setActive(0);
        setStatus('idle');
      } catch {
        if (!controller.signal.aborted) setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmed, topic]);

  useEffect(() => {
    if (!desktopOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setDesktopOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [desktopOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    mobileInput.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      const slash = event.key === '/' && !isTyping(event.target);
      if (!shortcut && !slash) return;
      event.preventDefault();
      if (window.matchMedia('(min-width: 640px)').matches) {
        desktopInput.current?.focus();
        setDesktopOpen(true);
      } else {
        setMobileOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (hasOptions) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, hasOptions, id]);

  function remember() {
    if (trimmed.length >= 2) saveRecent(trimmed);
  }

  function go(url: string) {
    remember();
    close();
    desktopInput.current?.blur();
    router.push(url);
  }

  function runSearch(value: string) {
    setQuery(value);
    setTopic('');
    (mobileOpen ? mobileInput : desktopInput).current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[active];
      if (item) go(item.url);
      else if (trimmed.length >= 2) go(`/search?q=${encodeURIComponent(trimmed)}`);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
      event.currentTarget.blur();
    }
  }

  function renderField(ref: RefObject<HTMLInputElement | null>, onFocus?: () => void) {
    return (
      <div className="flex h-10 w-full items-center gap-2.5 rounded-full bg-zinc-100 px-3 ring-1 ring-transparent transition-colors hover:bg-zinc-200/60 focus-within:bg-white focus-within:ring-zinc-300 focus-within:hover:bg-white">
        {icon ? (
          <img src={icon} alt="" width={24} height={24} className="h-6 w-6 shrink-0 rounded-full object-cover" />
        ) : (
          <SearchIcon className="shrink-0 text-zinc-500" />
        )}
        <input
          ref={ref}
          type="search"
          role="combobox"
          aria-label={text.openSearch}
          aria-expanded={hasOptions}
          aria-controls={`${id}-list`}
          aria-activedescendant={hasOptions ? `${id}-option-${active}` : undefined}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setTopic('');
          }}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder={text.placeholder}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="search-input h-full min-w-0 flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-500 sm:text-[15px] [&::-webkit-search-cancel-button]:hidden"
        />
        {status === 'loading' && (
          <span role="status" className="sr-only">
            {text.searching}
          </span>
        )}
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              ref.current?.focus();
            }}
            aria-label={text.clear}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-md bg-white px-1.5 py-0.5 font-sans text-xs text-zinc-500 ring-1 ring-zinc-200 lg:inline">⌘K</kbd>
        )}
      </div>
    );
  }

  const examples = text.examples
    .split(',')
    .map((example) => example.trim())
    .filter(Boolean);

  const rowClass = 'flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-zinc-800 active:bg-zinc-100 sm:hover:bg-zinc-100';
  const sectionTitle = 'px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500';

  const panel: ReactNode =
    trimmed.length < 2 ? (
      <div className="space-y-3 px-2 py-1">
        {recent.length > 0 && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className={sectionTitle}>{text.recent}</h2>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem(RECENT_KEY);
                  } catch {}
                  setRecent([]);
                }}
                className="h-8 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                {text.clearRecent}
              </button>
            </div>
            <ul>
              {recent.map((item) => (
                <li key={item}>
                  <button type="button" onClick={() => runSearch(item)} className={rowClass}>
                    <ClockIcon />
                    <span className="truncate">{item}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {examples.length > 0 && (
          <section>
            <h2 className={sectionTitle}>{text.tryThese}</h2>
            <ul>
              {examples.map((example) => (
                <li key={example}>
                  <button type="button" onClick={() => runSearch(example)} className={rowClass}>
                    <SearchIcon className="shrink-0 text-zinc-400" />
                    <span className="truncate">{example}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    ) : status === 'error' ? (
      <p className="px-5 py-6 text-sm text-zinc-600">{text.error}</p>
    ) : (
      <div className="px-2">
        {topics.length > 1 && (
          <div role="group" aria-label={text.topicsLabel} className="flex gap-2 overflow-x-auto px-2 pb-2 pt-1">
            {[{ slug: '', name: text.allTopics, count: 0 }, ...topics].map((item) => (
              <button
                key={item.slug || 'all'}
                type="button"
                aria-pressed={topic === item.slug}
                onClick={() => setTopic(item.slug)}
                className={`h-8 shrink-0 rounded-full px-3 text-sm font-medium ${
                  topic === item.slug ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 active:bg-zinc-200 sm:hover:bg-zinc-200'
                }`}
              >
                {item.name}
                {item.count > 0 && <span className="ml-1 opacity-60">{item.count}</span>}
              </button>
            ))}
          </div>
        )}
        {data && (
          <p className="px-3 pb-1 text-xs text-zinc-500">
            {showingSuggestions ? fill(text.noResults, { query: data.query }) : formatCount(data.results.length, text.resultOne, text.resultMany)}
          </p>
        )}
        {showingSuggestions && items.length > 0 && <h2 className={`${sectionTitle} pt-3`}>{text.closestMatches}</h2>}
        <ul id={`${id}-list`} role="listbox" aria-label={text.openSearch}>
          {items.map((item, index) => (
            <li key={item.url} id={`${id}-option-${index}`} role="option" aria-selected={index === active}>
              <Link
                href={item.url}
                onClick={() => {
                  remember();
                  close();
                }}
                onMouseMove={() => setActive(index)}
                className={`block rounded-xl px-3 py-2.5 ${index === active ? 'bg-zinc-100' : ''}`}
              >
                <SearchResult result={item} introduction={text.introduction} />
              </Link>
            </li>
          ))}
        </ul>
        {data && data.results.length > 0 && (
          <Link
            href={`/search?q=${encodeURIComponent(trimmed)}${topic ? `&topic=${encodeURIComponent(topic)}` : ''}`}
            onClick={() => {
              remember();
              close();
            }}
            className="mx-1 mt-1 flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-700 active:bg-zinc-100 sm:hover:bg-zinc-100"
          >
            <SearchIcon className="shrink-0 text-zinc-400" />
            {text.seeAll}
          </Link>
        )}
      </div>
    );

  return (
    <>
      <div ref={container} className="relative hidden w-full max-w-xl sm:block">
        {renderField(desktopInput, () => setDesktopOpen(true))}
        {desktopOpen && (
          <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200">
            <div className="max-h-[min(70vh,36rem)] overflow-y-auto overscroll-contain py-2">{panel}</div>
            <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">{text.keyboardHelp}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label={text.openSearch}
        aria-haspopup="dialog"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100 sm:hidden"
      >
        <SearchIcon />
      </button>

      {mobileOpen && (
        <div role="dialog" aria-modal="true" aria-label={text.openSearch} className="search-sheet fixed inset-0 z-50 flex flex-col bg-white sm:hidden">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
            {renderField(mobileInput)}
            <button type="button" onClick={close} className="h-10 shrink-0 px-2 text-sm font-medium text-zinc-700">
              {text.cancel}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">{panel}</div>
        </div>
      )}
    </>
  );
}