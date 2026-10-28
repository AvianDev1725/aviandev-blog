import type { SearchResult as Result } from '@/lib/search';

type Props = { result: Result; introduction: string };

export default function SearchResult({ result, introduction }: Props) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-xs font-medium text-zinc-500">{result.postTitle}</span>
      <span className="mt-0.5 block font-semibold leading-snug text-zinc-900">{result.heading || introduction}</span>
      {result.snippet.length > 0 && (
        <span className="mt-1 line-clamp-2 block text-sm text-zinc-600">
          {result.snippet.map((part, index) =>
            part.highlight ? (
              <mark key={index} className="rounded bg-amber-100 px-0.5 text-zinc-900">
                {part.text}
              </mark>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </span>
      )}
    </span>
  );
}