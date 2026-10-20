import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { generateToken, hashToken } from './token.js';
import { sessions, users } from '../db/schema.js';

export const SESSION_COOKIE = 'session';
const SESSION_DAYS = 7;

export async function createSession(userId: number) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getSessionUser(token: string) {
  const [row] = await db
    .select({
      user: {
        id: users.id, 
        name: users.name, 
        email: users.email, 
        role: users.role, 
        status: users.status, 
        firstName: users.firstName,
        lastName: users.lastName,
        emailVerifiedAt: users.emailVerifiedAt,
      },
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, hashToken(token)));

  if (!row) return null;
  if (row.expiresAt < new Date() || row.user.status !== 'active') {
    await deleteSession(token);
    return null;
  }
  return row.user;
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}