const titleWidths = ['w-3/5', 'w-2/3', 'w-1/2', 'w-3/4'];
const snippetWidths = ['w-11/12', 'w-4/5', 'w-full', 'w-5/6'];

export default function SearchDropdownSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="search-skeleton px-2">
      <div className="shimmer mx-3 mb-2 mt-1 h-3 w-20 rounded" />
      <ul>
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="space-y-2 rounded-xl px-3 py-2.5">
            <div className="shimmer h-3 w-32 rounded" />
            <div className={`shimmer h-4 rounded ${titleWidths[index % titleWidths.length]}`} />
            <div className={`shimmer h-3 rounded ${snippetWidths[index % snippetWidths.length]}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}