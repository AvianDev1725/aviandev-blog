import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL = 30 * 60 * 1000;

function secret() {
  const value = process.env.PREVIEW_SECRET;
  if (!value) throw new Error('PREVIEW_SECRET is not set');
  return value;
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createPreviewToken(postId: number, ttlMs = DEFAULT_TTL) {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${postId}.${expiresAt}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(expiresAt) };
}

export function verifyPreviewToken(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [id, expires, signature] = parts;
  const expected = Buffer.from(sign(`${id}.${expires}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (Number(expires) < Date.now()) return null;

  const postId = Number(id);
  return Number.isInteger(postId) && postId > 0 ? postId : null;
}