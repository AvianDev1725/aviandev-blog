import { cacheLife, cacheTag } from 'next/cache';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export type SnippetPart = { text: string; highlight: boolean };

export type SearchResult = {
  postSlug: string;
  postTitle: string;
  anchor: string;
  heading: string;
  url: string;
  snippet: SnippetPart[];
  publishedAt: string | null;
  readingMinutes: number;
  matchedBy: string[];
};

export type SearchTopic = { slug: string; name: string; count: number };

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  suggestions: SearchResult[];
  topics: SearchTopic[];
};

async function fetchSearch(query: string, topic: string): Promise<SearchResponse> {
  'use cache';
  cacheLife('minutes');
  cacheTag('posts');

  const params = new URLSearchParams({ q: query });
  if (topic) params.set('topic', topic);
  const res = await fetch(`${API_URL}/search?${params}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export async function searchOnServer(query: string, topic = ''): Promise<SearchResponse | null> {
  try {
    return await fetchSearch(query, topic);
  } catch (err) {
    console.error('[blog] search failed:', err);
    return null;
  }
}