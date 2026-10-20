import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { createSession, SESSION_COOKIE } from './session.js';

export async function startSession(c: Context, userId: number) {
  const { token, expiresAt } = await createSession(userId);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });
}