'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type TouchEvent } from 'react';
import type { InsightsText } from './text';
import { AskTab, ContentTab, OverviewTab, PeopleTab, SearchTab, TrafficTab } from './tabs';
import { RANGES, TAB_IDS, type TabData, type TabId } from './types';

type Props = {
  text: InsightsText;
  initialTab: TabId;
  initialDays: number;
  initialData: TabData[TabId] | null;
  blogUrl: string;
};

const TAB_ICONS: Record<TabId, string> = { overview: '✨', traffic: '🌍', content: '📝', people: '👥', search: '🔍', ask: '🤖' };

const tabLabel = (text: InsightsText, tab: TabId) =>
  ({
    overview: text.tabOverview,
    traffic: text.tabTraffic,
    content: text.tabContent,
    people: text.tabPeople,
    search: text.tabSearch,
    ask: text.tabAsk,
  })[tab];

const rangeLabel = (text: InsightsText, days: number) => (days === 90 ? text.last90 : days === 30 ? text.last30 : text.last7);

type Entry = { status: 'loading' | 'ready' | 'error'; data?: TabData[TabId] };

function Skeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 md:col-span-2 md:grid-cols-3" aria-hidden>
        {[0, 1, 2].map((index) => (
          <div key={index} className={`rounded-[14px] bg-white p-3.5 ring-1 ring-zinc-200 ${index === 2 ? 'col-span-2 md:col-span-1' : ''}`}>
            <div className="insights-shimmer h-3 w-24 rounded" />
            <div className="insights-shimmer mt-3 h-7 w-20 rounded" />
            <div className="insights-shimmer mt-3 h-[30px] w-full rounded" />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((index) => (
        <div key={index} className={`rounded-2xl bg-white p-4 ring-1 ring-zinc-200 ${index === 0 ? 'md:col-span-2' : ''}`} aria-hidden>
          <div className="insights-shimmer h-4 w-40 rounded" />
          <div className="insights-shimmer mt-2 h-3 w-56 rounded" />
          <div className="insights-shimmer mt-5 h-40 w-full rounded-xl" />
        </div>
      ))}
    </>
  );
}

export default function InsightsView({ text, initialTab, initialDays, initialData, blogUrl }: Props) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [days, setDays] = useState(initialDays);
  const [direction, setDirection] = useState(0);
  const [, rerender] = useState(0);
  const cache = useRef(new Map<string, Entry>(initialData ? [[`${initialTab}:${initialDays}`, { status: 'ready', data: initialData }]] : []));

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rangeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [ink, setInk] = useState({ left: 0, width: 0 });
  const [thumb, setThumb] = useState({ left: 0, width: 0 });
  const touch = useRef<{ x: number; y: number; at: number } | null>(null);

  const load = useCallback(async (nextTab: TabId, nextDays: number, force = false) => {
    const key = `${nextTab}:${nextDays}`;
    const existing = cache.current.get(key);
    if (!force && existing && existing.status !== 'error') return;
    cache.current.set(key, { status: 'loading' });
    rerender((count) => count + 1);
    try {
      const res = await fetch(`/api/insights/${nextTab}?days=${nextDays}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      cache.current.set(key, { status: 'ready', data: await res.json() });
    } catch {
      cache.current.set(key, { status: 'error' });
    }
    rerender((count) => count + 1);
  }, []);

  useEffect(() => {
    load(tab, days);
    try {
      window.history.replaceState(null, '', `/insights?tab=${tab}&days=${days}`);
    } catch {}
  }, [tab, days, load]);

  useLayoutEffect(() => {
    const button = tabRefs.current[TAB_IDS.indexOf(tab)];
    if (!button) return;
    setInk({ left: button.offsetLeft + 10, width: button.offsetWidth - 20 });
    button.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tab]);

  useLayoutEffect(() => {
    const measure = () => {
      const button = rangeRefs.current[RANGES.indexOf(days as (typeof RANGES)[number])];
      if (button) setThumb({ left: button.offsetLeft, width: button.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [days]);

  function selectTab(next: TabId) {
    if (next === tab) return;
    setDirection(TAB_IDS.indexOf(next) > TAB_IDS.indexOf(tab) ? 1 : -1);
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectDays(next: number) {
    if (next === days) return;
    setDirection(0);
    setDays(next);
  }

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = TAB_IDS.indexOf(tab);
    const next = event.key === 'ArrowRight' ? TAB_IDS[index + 1] : event.key === 'ArrowLeft' ? TAB_IDS[index - 1] : undefined;
    if (!next) return;
    event.preventDefault();
    selectTab(next);
    tabRefs.current[TAB_IDS.indexOf(next)]?.focus();
  }

  function onTouchStart(event: TouchEvent) {
    const point = event.touches[0];
    if (point) touch.current = { x: point.clientX, y: point.clientY, at: Date.now() };
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touch.current;
    const point = event.changedTouches[0];
    touch.current = null;
    if (!start || !point) return;
    if ((event.target as HTMLElement).closest('svg, table, [data-no-swipe]')) return;
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - start.at > 600) return;
    const index = TAB_IDS.indexOf(tab);
    const next = TAB_IDS[dx < 0 ? index + 1 : index - 1];
    if (next) selectTab(next);
  }

  const entry = cache.current.get(`${tab}:${days}`);
  const shared = { text, days, blogUrl };
  let body: ReactNode;

  if (!entry || entry.status === 'loading') {
    body = <Skeleton />;
  } else if (entry.status === 'error' || !entry.data) {
    body = (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-zinc-200 md:col-span-2">
        <p className="text-zinc-700">{text.loadFailed}</p>
        <button
          type="button"
          onClick={() => load(tab, days, true)}
          className="mt-3 h-10 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          {text.retry}
        </button>
      </div>
    );
  } else {
    const data = entry.data as never;
    body =
      tab === 'overview' ? (
        <OverviewTab data={data} {...shared} />
      ) : tab === 'traffic' ? (
        <TrafficTab data={data} {...shared} />
      ) : tab === 'content' ? (
        <ContentTab data={data} {...shared} />
      ) : tab === 'people' ? (
        <PeopleTab data={data} {...shared} />
      ) : tab === 'search' ? (
        <SearchTab data={data} {...shared} />
      ) : (
        <AskTab data={data} {...shared} />
      );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="sticky top-0 z-20 -mx-4 bg-zinc-50/90 px-4 pt-1 backdrop-blur-lg md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">{text.title}</h1>
            <p className="hidden text-sm text-zinc-500 sm:block">{text.subtitle}</p>
          </div>
          <div role="group" aria-label={text.rangeLabel} className="relative inline-flex rounded-full bg-zinc-200/70 p-[3px]">
            <span
              className="absolute bottom-[3px] top-[3px] rounded-full bg-white shadow-sm transition-[left,width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{ left: thumb.left, width: thumb.width }}
              aria-hidden
            />
            {RANGES.map((range, index) => (
              <button
                key={range}
                ref={(element) => {
                  rangeRefs.current[index] = element;
                }}
                type="button"
                aria-pressed={days === range}
                onClick={() => selectDays(range)}
                className={`relative h-8 rounded-full px-3 text-[13.5px] font-semibold transition-colors ${days === range ? 'text-zinc-900' : 'text-zinc-600'}`}
              >
                {rangeLabel(text, range)}
              </button>
            ))}
          </div>
        </div>

        <div
          role="tablist"
          aria-label={text.tabsLabel}
          onKeyDown={onTabKey}
          className="relative -mx-4 mt-2 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {TAB_IDS.map((id, index) => (
            <button
              key={id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`insights-tab-${id}`}
              role="tab"
              type="button"
              aria-selected={tab === id}
              aria-controls="insights-panel"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => selectTab(id)}
              onPointerEnter={() => load(id, days)}
              className={`inline-flex h-11 shrink-0 items-center gap-1.5 px-3 text-[14.5px] font-semibold transition-colors ${
                tab === id ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span aria-hidden>{TAB_ICONS[id]}</span>
              {tabLabel(text, id)}
            </button>
          ))}
          <span
            className="absolute bottom-0 h-[3px] rounded-t bg-teal-600 transition-[left,width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{ left: ink.left, width: ink.width }}
            aria-hidden
          />
        </div>
        <div className="-mx-4 border-b border-zinc-200 md:-mx-6" />
      </header>

      <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          key={`${tab}:${days}:${entry?.status}`}
          id="insights-panel"
          role="tabpanel"
          aria-labelledby={`insights-tab-${tab}`}
          aria-busy={entry?.status === 'loading'}
          className={`grid gap-3.5 py-4 md:grid-cols-2 ${direction > 0 ? 'insights-enter-right' : direction < 0 ? 'insights-enter-left' : ''}`}
        >
          {body}
        </div>
      </div>
    </div>
  );
}