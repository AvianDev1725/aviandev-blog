'use client';

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { newSearchId, sendSearchEvent } from '@/lib/search-events';

type Props = { query: string; topic: string; resultCount: number; searchId?: string; children: ReactNode };

export default function SearchPageTracker({ query, topic, resultCount, searchId, children }: Props) {
  const id = useRef('');

  useEffect(() => {
    if (!id.current) id.current = searchId || newSearchId();
    sendSearchEvent({ clientId: id.current, query, resultCount, topic: topic || undefined, progress: 50 });
  }, [query, topic, resultCount, searchId]);

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const href = (event.target as HTMLElement).closest('a')?.getAttribute('href');
    if (!href?.startsWith('/posts/') || !id.current) return;
    sendSearchEvent({ clientId: id.current, query, resultCount, topic: topic || undefined, openedUrl: href, progress: 100 });
  }

  return <div onClick={onClick}>{children}</div>;
}