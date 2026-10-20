'use client';

import { useEffect, useState } from 'react';
import { formatCount } from '@aviandev/core/text';

type Props = { slug: string; one: string; many: string };

const formatter = new Intl.NumberFormat('en-IN');

export default function ViewCounter({ slug, one, many }: Props) {
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/views/${encodeURIComponent(slug)}`, { method: 'POST', keepalive: true, signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.views === 'number') setViews(data.views);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [slug]);

    const label = views === null ? '' : formatCount(views, one, many);

  return (
    <span aria-live="polite" className="inline-block min-w-24">
      {label}
    </span>
  );
}