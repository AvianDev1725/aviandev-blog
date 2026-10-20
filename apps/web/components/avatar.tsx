const COLORS = [
  'bg-amber-700',
  'bg-sky-700',
  'bg-emerald-700',
  'bg-rose-700',
  'bg-violet-700',
  'bg-teal-700',
  'bg-orange-700',
  'bg-indigo-700',
];

type Person = { firstName?: string | null; lastName?: string | null; name: string };

export function initialsOf({ firstName, lastName, name }: Person) {
  const parts = name.trim().split(/\s+/);
  const first = firstName?.trim() || parts[0] || '';
  const last = lastName?.trim() || (parts.length > 1 ? parts[parts.length - 1] : '');
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
}

function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export default function Avatar({ size = 'md', ...person }: Person & { size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizeClass} ${colorFor(person.name)}`}
    >
      {initialsOf(person)}
    </span>
  );
}