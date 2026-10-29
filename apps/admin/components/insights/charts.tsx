'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from 'react';

export const formatNumber = (value: number) => value.toLocaleString('en-IN');
export const formatDay = (day: string) =>
  new Date(`${day}T00:00:00.000Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const percent = (part: number, whole: number) => (whole ? Math.round((100 * part) / whole) : 0);
export const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const step = value / power;
  return (step <= 1 ? 1 : step <= 2 ? 2 : step <= 5 ? 5 : 10) * power;
}

const shortNumber = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : formatNumber(value));

/** Mouse: hide the tooltip when the pointer leaves. Touch: keep it until the reader taps somewhere else. */
function useHover(container: RefObject<HTMLElement | null>) {
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (hover === null) return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setHover(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [hover, container]);
  const leave = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') setHover(null);
  };
  return [hover, setHover, leave] as const;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? 0)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function labelIndexes(count: number, width: number) {
  const every = Math.max(1, Math.ceil(count / (width < 420 ? 4 : 7)));
  const shown: number[] = [];
  for (let index = 0; index < count; index += every) shown.push(index);
  const last = count - 1;
  if (shown.at(-1) !== last) {
    if (shown.length > 1 && last - (shown.at(-1) ?? 0) < every * 0.6) shown.pop();
    shown.push(last);
  }
  return new Set(shown);
}

type Tip = { x: number; title: string; rows: { label: string; value: number; color: string }[] };

function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 70), Math.max(70, width - 70));
  return (
    <div
      role="status"
      className="insights-tip pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-xl bg-zinc-900 px-3 py-2 text-[12.5px] leading-snug text-white shadow-lg"
      style={{ left }}
    >
      <p className="font-semibold">{tip.title}</p>
      {tip.rows.map((row) => (
        <p key={row.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: row.color }} aria-hidden />
          {row.label}: <b className="font-semibold">{formatNumber(row.value)}</b>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="mb-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-zinc-600">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={item.line ? 'h-[3px] w-3.5 rounded-full' : 'h-2.5 w-2.5 rounded-[3px]'} style={{ background: item.color }} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ---------- Line chart: one shared axis ---------- */

export type Line = { label: string; color: string; values: number[]; fill?: string };

export function LineChart({ dates, lines, height = 200 }: { dates: string[]; lines: Line[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover, leave] = useHover(ref);
  const svg = useRef<SVGSVGElement>(null);

  const pad = { l: 34, r: 8, t: 10, b: 24 };
  const plotW = Math.max(1, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...lines.flatMap((line) => line.values)));
  const x = (index: number) => pad.l + (dates.length <= 1 ? plotW / 2 : (index / (dates.length - 1)) * plotW);
  const y = (value: number) => pad.t + plotH - (value / max) * plotH;
  const shownLabels = labelIndexes(dates.length, width);
  const dataKey = `${dates[0]}-${dates.length}-${lines.map((line) => total(line.values)).join('-')}`;

  useLayoutEffect(() => {
    svg.current?.querySelectorAll<SVGPathElement>('path.chart-line').forEach((path) => {
      path.style.setProperty('--len', String(path.getTotalLength()));
    });
  }, [width, dataKey]);

  function onPointer(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    setHover(Math.max(0, Math.min(dates.length - 1, Math.round(((px - pad.l) / plotW) * (dates.length - 1)))));
  }

  const tip: Tip | null =
    hover === null
      ? null
      : { x: x(hover), title: formatDay(dates[hover] ?? ''), rows: lines.map((line) => ({ label: line.label, value: line.values[hover] ?? 0, color: line.color })) };

  return (
    <div ref={ref} className="relative w-full touch-pan-y" style={{ height }}>
      {width > 0 && (
        <svg
          key={dataKey}
          ref={svg}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={lines.map((line) => line.label).join(', ')}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={leave}
          className="block overflow-visible"
        >
          {[0, max / 2, max].map((tick) => (
            <g key={tick}>
              <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} className="stroke-zinc-100" />
              <text x={pad.l - 6} y={y(tick) + 4} textAnchor="end" className="fill-zinc-500 text-[11px] tabular-nums">
                {shortNumber(tick)}
              </text>
            </g>
          ))}
          {dates.map((date, index) =>
            shownLabels.has(index) ? (
              <text key={date} x={x(index)} y={height - 6} textAnchor="middle" className="fill-zinc-500 text-[11px]">
                {formatDay(date)}
              </text>
            ) : null,
          )}
          {lines.map((line) => {
            const d = line.values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join('');
            return line.fill ? <path key={`${line.label}-fill`} d={`${d}L${x(line.values.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={line.fill} className="chart-area" /> : null;
          })}
          {lines.map((line, index) => (
            <path
              key={line.label}
              d={line.values.map((value, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(value).toFixed(1)}`).join('')}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="chart-line"
              style={{ animationDelay: `${index * 0.12}s` }}
            />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} stroke="#a1a1aa" strokeDasharray="3 3" />
              {lines.map((line) => (
                <circle key={line.label} cx={x(hover)} cy={y(line.values[hover] ?? 0)} r={4.5} fill={line.color} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/* ---------- Column chart (optionally stacked) ---------- */

export type Stack = { label: string; color: string; values: number[] };

export function ColumnChart({ dates, stacks, height = 180 }: { dates: string[]; stacks: Stack[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover, leave] = useHover(ref);

  const pad = { l: 30, r: 4, t: 8, b: 24 };
  const plotW = Math.max(1, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const totals = dates.map((_, index) => total(stacks.map((stack) => stack.values[index] ?? 0)));
  const max = niceMax(Math.max(1, ...totals));
  const slot = plotW / Math.max(1, dates.length);
  const barW = Math.max(3, Math.min(26, slot - 2));
  const scale = (value: number) => (value / max) * plotH;
  const shownLabels = labelIndexes(dates.length, width);
  const dataKey = `${dates[0]}-${dates.length}-${totals.join('-')}`;

  const tip: Tip | null =
    hover === null
      ? null
      : {
          x: pad.l + slot * hover + slot / 2,
          title: formatDay(dates[hover] ?? ''),
          rows: stacks.map((stack) => ({ label: stack.label, value: stack.values[hover] ?? 0, color: stack.color })),
        };

  return (
    <div ref={ref} className="relative w-full touch-pan-y" style={{ height }}>
      {width > 0 && (
        <svg key={dataKey} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={stacks.map((s) => s.label).join(', ')} className="block overflow-visible">
          {[0, max / 2, max].map((tick) => {
            const ty = pad.t + plotH - scale(tick);
            return (
              <g key={tick}>
                <line x1={pad.l} x2={width - pad.r} y1={ty} y2={ty} className="stroke-zinc-100" />
                <text x={pad.l - 6} y={ty + 4} textAnchor="end" className="fill-zinc-500 text-[11px] tabular-nums">
                  {shortNumber(tick)}
                </text>
              </g>
            );
          })}
          {dates.map((date, index) => {
            const cx = pad.l + slot * index + slot / 2;
            let base = pad.t + plotH;
            const visible = stacks.filter((stack) => (stack.values[index] ?? 0) > 0);
            return (
              <g key={date} className={hover !== null && hover !== index ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                {visible.map((stack, stackIndex) => {
                  const h = scale(stack.values[index] ?? 0);
                  const top = base - h;
                  const isTop = stackIndex === visible.length - 1;
                  const r = Math.min(4, barW / 2, h);
                  const left = cx - barW / 2;
                  const right = cx + barW / 2;
                  const d = isTop
                    ? `M${left},${base}V${top + r}Q${left},${top} ${left + r},${top}H${right - r}Q${right},${top} ${right},${top + r}V${base}Z`
                    : `M${left},${base}V${top}H${right}V${base}Z`;
                  base = top - 2;
                  return <path key={stack.label} d={d} fill={stack.color} className="chart-bar" style={{ animationDelay: `${(index / dates.length) * 0.35}s` }} />;
                })}
                {shownLabels.has(index) && (
                  <text x={cx} y={height - 6} textAnchor="middle" className="fill-zinc-500 text-[11px]">
                    {formatDay(date)}
                  </text>
                )}
                <rect
                  x={pad.l + slot * index}
                  y={pad.t}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setHover(index)}
                  onPointerDown={() => setHover(index)}
                  onPointerLeave={leave}
                />
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/* ---------- Ranked horizontal bars ---------- */

export type RankItem = { key: string; label: ReactNode; sub?: ReactNode; value: number; display?: string };

export function RankBars({ items, color = 'var(--chart-1)', empty }: { items: RankItem[]; color?: string; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
      {items.map((item, index) => (
        <li key={item.key} className="grid min-w-0 gap-1">
          <div className="flex min-w-0 items-baseline justify-between gap-3 text-[13.5px]">
            <span className="block min-w-0 flex-1 truncate text-zinc-900">
              {item.label}
              {item.sub && <span className="text-xs text-zinc-500"> · {item.sub}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-zinc-600">{item.display ?? formatNumber(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="chart-grow-x h-full rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: color, animationDelay: `${index * 0.06}s` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Share of a whole ---------- */

export function ShareBar({ items, empty }: { items: { key: string; label: string; value: number; color: string }[]; empty: string }) {
  const sum = total(items.map((item) => item.value));
  if (sum === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <div>
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={items.map((item) => `${item.label} ${percent(item.value, sum)}%`).join(', ')}>
        {items
          .filter((item) => item.value > 0)
          .map((item, index) => (
            <div key={item.key} className="chart-grow-x h-full" style={{ width: `${(item.value / sum) * 100}%`, background: item.color, animationDelay: `${index * 0.08}s` }} />
          ))}
      </div>
      <ul className="mt-3.5 grid gap-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-[13.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: item.color }} aria-hidden />
            <span className="text-zinc-900">{item.label}</span>
            <span className="ml-auto tabular-nums text-zinc-600">
              {formatNumber(item.value)} · {percent(item.value, sum)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Funnel ---------- */

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const first = steps[0]?.value ?? 0;
  return (
    <ul className="grid gap-2.5">
      {steps.map((step, index) => {
        const share = percent(step.value, first);
        return (
          <li key={step.label}>
            <div className="mb-1 flex justify-between gap-3 text-[13.5px]">
              <span className="text-zinc-900">{step.label}</span>
              <span className="tabular-nums text-zinc-600">
                {formatNumber(step.value)} · {share}%
              </span>
            </div>
            <div className="h-8 overflow-hidden rounded-lg bg-zinc-100">
              <div
                className="chart-grow-x flex h-full items-center rounded-lg pl-2.5 text-[12.5px] font-semibold text-white"
                style={{ width: `${Math.max(share, step.value ? 8 : 0)}%`, background: 'var(--chart-1)', animationDelay: `${index * 0.1}s` }}
              >
                {share > 12 ? `${share}%` : ''}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Sparkline and counting number ---------- */

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const points = values
    .map((value, index) => `${((index / Math.max(1, values.length - 1)) * 100).toFixed(2)},${(28 - (value / max) * 26).toFixed(2)}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-1.5 block h-[30px] w-full" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={1.8}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="chart-line"
        style={{ '--len': 400 } as CSSProperties}
      />
    </svg>
  );
}

export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 700);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <>
      {formatNumber(shown)}
      {suffix}
    </>
  );
}