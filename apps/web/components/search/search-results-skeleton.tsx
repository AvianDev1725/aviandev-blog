type Props = { label: string; rows?: number };

const snippetWidths = ['w-full', 'w-11/12', 'w-4/5', 'w-10/12', 'w-3/4'];

export default function SearchResultsSkeleton({ label, rows = 5 }: Props) {
  return (
    <div aria-busy="true">
      <span role="status" className="sr-only">
        {label}
      </span>

      <div aria-hidden className="mt-6 flex gap-2">
        <div className="shimmer h-12 flex-1 rounded-xl" />
        <div className="shimmer h-12 w-24 shrink-0 rounded-xl" />
      </div>

      <div aria-hidden className="mt-4 flex gap-2 overflow-hidden">
        {['w-12', 'w-20', 'w-16', 'w-24'].map((width) => (
          <div key={width} className={`shimmer h-9 shrink-0 rounded-full ${width}`} />
        ))}
      </div>

      <div aria-hidden className="shimmer mt-6 h-4 w-24 rounded" />

      <ul aria-hidden className="mt-2 divide-y divide-zinc-100">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="space-y-2.5 py-4 sm:px-3">
            <div className="shimmer h-3.5 w-40 rounded" />
            <div className="shimmer h-5 w-3/4 rounded" />
            <div className={`shimmer h-3.5 rounded ${snippetWidths[index % snippetWidths.length]}`} />
            <div className="shimmer h-3.5 w-2/3 rounded" />
          </li>
        ))}
      </ul>
    </div>
  );
}