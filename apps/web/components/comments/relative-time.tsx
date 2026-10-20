'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@aviandev/core/text';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

const formatter = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

function relative(value: string, justNow: string) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return justNow;
}

export default function RelativeTime({ value, justNow }: { value: string; justNow: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(relative(value, justNow));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [value, justNow]);

  return (
    <time dateTime={value} title={formatDate(value)} suppressHydrationWarning>
      {label ?? formatDate(value)}
    </time>
  );
}