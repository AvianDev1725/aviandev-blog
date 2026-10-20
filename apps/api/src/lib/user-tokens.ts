import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userTokens } from '../db/schema.js';

export type TokenPurpose = 'verify_email' | 'reset_password';

export const VERIFY_EMAIL_TTL = 24 * 60 * 60 * 1000;
export const RESET_PASSWORD_TTL = 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueUserToken(userId: number, purpose: TokenPurpose, ttlMs: number) {
  await db
    .update(userTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(userTokens.userId, userId), eq(userTokens.purpose, purpose), isNull(userTokens.usedAt)));

  const token = randomBytes(32).toString('base64url');
  await db.insert(userTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

export async function consumeUserToken(token: string, purpose: TokenPurpose) {
  const [row] = await db
    .update(userTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(userTokens.tokenHash, hashToken(token)),
        eq(userTokens.purpose, purpose),
        isNull(userTokens.usedAt),
        gt(userTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: userTokens.userId });
  return row?.userId ?? null;
}