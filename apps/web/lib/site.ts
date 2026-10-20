export const siteUrl = (process.env.SITE_URL ?? 'http://localhost:3002').replace(/\/$/, '');

export function absoluteUrl(path: string) {
  return `${siteUrl}${path}`;
}