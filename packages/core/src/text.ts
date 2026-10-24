export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match
  );
}

export function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function headingAnchors(headings: string[]) {
  const seen = new Map<string, number>();
  return headings.map((heading) => {
    const base = toSlug(heading) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
}

export function formatDate(value: string | Date, locale = 'en-IN') {
  return new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' });
}

export function isSafeLink(value: string) {
  return /^https?:\/\//i.test(value) || /^mailto:/i.test(value) || (value.startsWith('/') && !value.startsWith('//'));
}

export function formatCount(count: number, one: string, many: string, locale = 'en-IN') {
  return count === 1 ? one : fill(many, { count: new Intl.NumberFormat(locale).format(count) });
}