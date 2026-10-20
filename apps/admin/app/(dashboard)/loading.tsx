export default function Loading() {
  return (
    <div className="max-w-4xl animate-pulse space-y-6 motion-reduce:animate-none" aria-busy="true">
      <div className="space-y-2">
        <div className="h-7 w-44 rounded-lg bg-zinc-200" />
        <div className="h-4 w-64 rounded bg-zinc-200" />
      </div>
      <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-14 rounded-lg bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}