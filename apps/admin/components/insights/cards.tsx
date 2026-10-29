'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { CountUp, Sparkline, formatNumber, total } from './charts';

type CardText = { showAs: string; chartView: string; listView: string };

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

const storageKey = (id: string) => `insights-view-${id}`;

/** A card with a chart / list switch. The choice is remembered per card in this browser. */
export function ChartCard({
  id,
  title,
  hint,
  wide,
  text,
  chart,
  list,
  footer,
}: {
  id: string;
  title: string;
  hint?: string;
  wide?: boolean;
  text: CardText;
  chart: ReactNode;
  list?: ReactNode;
  footer?: ReactNode;
}) {
  const [mode, setMode] = useState<'chart' | 'list'>('chart');
  const [switched, setSwitched] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey(id)) === 'list') setMode('list');
    } catch {}
  }, [id]);

  function choose(next: 'chart' | 'list') {
    if (next === mode) return;
    setMode(next);
    setSwitched((count) => count + 1);
    try {
      localStorage.setItem(storageKey(id), next);
    } catch {}
  }

  const showList = Boolean(list) && mode === 'list';

  return (
    <section aria-labelledby={`${id}-title`} className={`min-w-0 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 ${wide ? 'md:col-span-2' : ''}`}>
      <div className="mb-3.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-[15.5px] font-semibold text-zinc-900">
            {title}
          </h2>
          {hint && <p className="mt-0.5 text-[13px] text-zinc-500">{hint}</p>}
        </div>
        {list && (
          <div role="group" aria-label={text.showAs} className="flex shrink-0 rounded-[10px] bg-zinc-100 p-0.5">
            {(['chart', 'list'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                aria-label={option === 'chart' ? text.chartView : text.listView}
                title={option === 'chart' ? text.chartView : text.listView}
                onClick={() => choose(option)}
                className={`grid h-[30px] w-[34px] place-items-center rounded-lg transition-colors ${
                  mode === option ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {option === 'chart' ? <ChartIcon /> : <ListIcon />}
              </button>
            ))}
          </div>
        )}
      </div>
      <div key={`${mode}-${switched}`} className={switched ? 'insights-view-in' : undefined}>
        {showList ? list : chart}
      </div>
      {footer}
    </section>
  );
}

export function DataTable({ columns, rows, empty }: { columns: { label: string; numeric?: boolean }[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.label}
                scope="col"
                className={`pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${column.numeric ? 'text-right' : 'text-left'} ${index ? 'pl-3' : ''}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="insights-row border-t border-zinc-100" style={{ animationDelay: `${Math.min(rowIndex, 12) * 0.03}s` }}>
              {row.map((cell, index) => (
                <td key={index} className={`py-2.5 align-top ${columns[index]?.numeric ? 'text-right tabular-nums' : ''} ${index ? 'pl-3' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type Kpi = {
  key: string;
  label: string;
  icon: string;
  /** A series per day (shows a trend line), or a single number. */
  values?: number[];
  value?: number;
  previous?: number;
  suffix?: string;
  note?: string;
};

function delta(now: number, before: number, newLabel: string) {
  if (!before) return now ? { tone: 'text-zinc-500', text: newLabel } : null;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return { tone: 'text-zinc-500', text: '0%' };
  return { tone: change > 0 ? 'text-emerald-700' : 'text-amber-700', text: `${change > 0 ? '▲' : '▼'} ${Math.abs(change)}%` };
}

export function KpiGrid({ items, compareNote, vsPrevious, newLabel }: { items: Kpi[]; compareNote?: string; vsPrevious: string; newLabel: string }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:col-span-2 md:grid-cols-3">
      {compareNote && items.some((item) => item.previous !== undefined) && (
        <p className="col-span-2 -mb-1 text-[12.5px] text-zinc-500 sm:hidden">{compareNote}</p>
      )}
      {items.map((item, index) => {
        const value = item.values ? total(item.values) : (item.value ?? 0);
        const change = item.previous !== undefined ? delta(value, item.previous, newLabel) : null;
        const lone = items.length % 2 === 1 && index === items.length - 1;
        return (
          <div key={item.key} className={`min-w-0 rounded-[14px] bg-white px-3.5 py-3 ring-1 ring-zinc-200 ${lone ? 'col-span-2 md:col-span-1' : ''}`}>
            <p className="flex items-center gap-1.5 text-[12.5px] text-zinc-500">
              <span aria-hidden>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </p>
            <p className="mt-0.5 text-[26px] font-bold tracking-tight text-zinc-900 tabular-nums">
              <CountUp value={value} suffix={item.suffix} />
            </p>
            {change ? (
              <p className={`text-[12.5px] font-semibold ${change.tone}`}>
                {change.text} <span className="hidden font-normal text-zinc-500 sm:inline">{vsPrevious}</span>
              </p>
            ) : (
              item.note && <p className="text-[12.5px] text-zinc-500">{item.note}</p>
            )}
            {item.values && <Sparkline values={item.values} />}
          </div>
        );
      })}
    </div>
  );
}

/** Post ideas with "Start a post" and "Dismiss" (dismissing hides it until it comes up again). */
export function IdeaList({
  ideas,
  empty,
  startLabel,
  dismissLabel,
}: {
  ideas: { query: string; meta: string }[];
  empty: string;
  startLabel: string;
  dismissLabel: string;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const shown = ideas.filter((idea) => !hidden.includes(idea.query));
  if (shown.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;

  async function dismiss(query: string) {
    setHidden((list) => [...list, query]);
    try {
      const res = await fetch('/api/insights/search/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setHidden((list) => list.filter((item) => item !== query));
    }
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {shown.map((idea, index) => (
        <li key={idea.query} className="insights-row flex flex-wrap items-center gap-2.5 py-2.5" style={{ animationDelay: `${index * 0.04}s` }}>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-900">{idea.query}</p>
            <p className="text-[12.5px] text-zinc-500">{idea.meta}</p>
          </div>
          <Link
            href={`/posts/new?title=${encodeURIComponent(idea.query)}`}
            className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-3 text-[13px] font-semibold text-white hover:bg-zinc-700"
          >
            {startLabel}
          </Link>
          <button
            type="button"
            onClick={() => dismiss(idea.query)}
            className="h-9 rounded-lg px-3 text-[13px] font-semibold text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
          >
            {dismissLabel}
          </button>
        </li>
      ))}
    </ul>
  );
}

export { formatNumber };