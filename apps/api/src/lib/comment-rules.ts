export const GUEST_AVATARS = [
  'owl',
  'kingfisher',
  'robin',
  'heron',
  'sparrow',
  'parrot',
  'penguin',
  'flamingo',
  'puffin',
  'toucan',
  'eagle',
  'hummingbird',
] as const;

export type GuestAvatar = (typeof GUEST_AVATARS)[number];
export type Role = 'reader' | 'admin' | 'super_admin';

export const MAX_COMMENT_LENGTH = 2000;
const MIN_FILL_TIME_MS = 3000;
const MAX_FILL_TIME_MS = 24 * 60 * 60 * 1000;
const LINKS_BEFORE_REVIEW = 2;

export function cleanBody(body: string) {
  return body
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function countLinks(body: string) {
  return body.match(/https?:\/\/|www\./gi)?.length ?? 0;
}

export function looksLikeBot(input: { website?: string; startedAt?: number }, now = Date.now()) {
  if (input.website) return true;
  if (typeof input.startedAt !== 'number') return true;
  const elapsed = now - input.startedAt;
  return elapsed < MIN_FILL_TIME_MS || elapsed > MAX_FILL_TIME_MS;
}

export function isStaff(role: Role) {
  return role === 'admin' || role === 'super_admin';
}

export function initialStatus(commenter: { role: Role } | null, body: string) {
  if (!commenter) return 'pending' as const;
  if (isStaff(commenter.role)) return 'approved' as const;
  return countLinks(body) >= LINKS_BEFORE_REVIEW ? ('pending' as const) : ('approved' as const);
}

export function canModerate(user: { id: number; role: Role }, postAuthorId: number | null) {
  return user.role === 'super_admin' || (user.role === 'admin' && postAuthorId === user.id);
}