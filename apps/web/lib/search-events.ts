export type SearchProgress = 0 | 50 | 100;

export type SearchEvent = {
  clientId: string;
  query: string;
  resultCount: number;
  topic?: string;
  openedUrl?: string;
  progress: SearchProgress;
};

export function newSearchId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function sendSearchEvent(event: SearchEvent) {
  try {
    fetch('/api/search/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}