import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { fill, formatCount } from '@aviandev/core/text';
import SearchResult from '@/components/search/search-result';
import { getContentByCMS } from '@/lib/content';
import { searchOnServer } from '@/lib/search';
import { searchText, type SearchText } from '../text';

type Params = Promise<{ q?: string | string[]; topic?: string | string[] }>;

export async function generateMetadata(): Promise<Metadata> {
  const text = await getContentByCMS('web-search', searchText);
  return { title: text.pageTitle, robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: { searchParams: Params }) {
  const text = await getContentByCMS('web-search', searchText);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{text.pageTitle}</h1>
      <Suspense fallback={<SearchForm text={text} query="" />}>
        <Results searchParams={searchParams} text={text} />
      </Suspense>
    </div>
  );
}

function SearchForm({ text, query }: { text: SearchText; query: string }) {
  return (
    <form action="/search" role="search" className="mt-6 flex gap-2">
      <label htmlFor="search-page-input" className="sr-only">
        {text.openSearch}
      </label>
      <input
        id="search-page-input"
        name="q"
        type="search"
        defaultValue={query}
        placeholder={text.placeholder}
        enterKeyHint="search"
        className="h-12 min-w-0 flex-1 rounded-xl border border-zinc-300 px-4 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      <button type="submit" className="h-12 shrink-0 rounded-xl bg-zinc-900 px-5 font-medium text-white hover:bg-zinc-700">
        {text.submit}
      </button>
    </form>
  );
}

const first = (value: string | string[] | undefined) => (typeof value === 'string' ? value.trim() : '');

async function Results({ searchParams, text }: { searchParams: Params; text: SearchText }) {
  const params = await searchParams;
  const query = first(params.q).slice(0, 200);
  const topic = first(params.topic);

  if (query.length < 2) {
    return (
      <>
        <SearchForm text={text} query={query} />
        {query.length === 1 && <p className="mt-4 text-sm text-zinc-500">{text.tooShort}</p>}
      </>
    );
  }

  const data = await searchOnServer(query, topic);
  const unfiltered = topic ? await searchOnServer(query) : data;
  const topics = unfiltered?.topics ?? [];
  const items = data ? (data.results.length > 0 ? data.results : data.suggestions) : [];
  const href = (slug: string) => `/search?q=${encodeURIComponent(query)}${slug ? `&topic=${encodeURIComponent(slug)}` : ''}`;

  return (
    <>
      <SearchForm text={text} query={query} />

      {topics.length > 1 && (
        <nav aria-label={text.topicsLabel} className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ slug: '', name: text.allTopics, count: 0 }, ...topics].map((item) => (
            <Link
              key={item.slug || 'all'}
              href={href(item.slug)}
              aria-current={topic === item.slug ? 'page' : undefined}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium ${
                topic === item.slug ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {item.name}
              {item.count > 0 && <span className="ml-1 opacity-60">{item.count}</span>}
            </Link>
          ))}
        </nav>
      )}

      {!data ? (
        <p className="mt-8 text-zinc-600">{text.error}</p>
      ) : (
        <>
          <p role="status" className="mt-6 text-sm text-zinc-500">
            {data.results.length > 0
              ? formatCount(data.results.length, text.resultOne, text.resultMany)
              : fill(text.noResults, { query })}
          </p>
          {data.results.length === 0 && items.length > 0 && (
            <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-500">{text.closestMatches}</h2>
          )}
          <ul className="mt-2 divide-y divide-zinc-100">
            {items.map((item) => (
              <li key={item.url}>
                <Link href={item.url} className="-mx-4 block px-4 py-4 active:bg-zinc-50 sm:mx-0 sm:rounded-xl sm:px-3 sm:hover:bg-zinc-50">
                  <SearchResult result={item} introduction={text.introduction} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}