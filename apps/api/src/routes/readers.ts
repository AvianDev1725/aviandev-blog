import { Hono } from 'hono';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { emails, sendEmail } from '../lib/email.js';
import { hashPassword } from '../lib/password.js';
import { startSession } from '../lib/session-cookie.js';
import { consumeUserToken, issueUserToken, RESET_PASSWORD_TTL, VERIFY_EMAIL_TTL } from '../lib/user-tokens.js';
import { validateJson } from '../lib/validate.js';
import { emailField, nameField, passwordField } from '../schemas/user.js';

const signupSchema = z.object({ firstName: nameField, lastName: nameField, email: emailField, password: passwordField });
const tokenSchema = z.object({ token: z.string().min(1).max(200) });
const forgotSchema = z.object({ email: z.string().trim().toLowerCase().min(1, 'Email is required').max(254) });
const resetSchema = z.object({ token: z.string().min(1).max(200), password: passwordField });

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const INVALID_LINK = 'This link is invalid or has expired';
/** Lets the blog tell a bad link apart from other errors, like a weak password. */
const INVALID_LINK_CODE = 'invalid_link';

type Recipient = { id: number; email: string; name: string; firstName: string | null };

async function sendVerification(user: Recipient) {
  const token = await issueUserToken(user.id, 'verify_email', VERIFY_EMAIL_TTL);
  await sendEmail({ to: user.email, ...(await emails.verifyEmail(user.firstName ?? user.name, token)) });
}

const recipientColumns = { id: users.id, email: users.email, name: users.name, firstName: users.firstName };

const readers = new Hono<AuthEnv>();

readers.post('/signup', rateLimit({ windowMs: FIFTEEN_MINUTES, max: 5 }), validateJson(signupSchema), async (c) => {
  const { firstName, lastName, email, password } = c.req.valid('json');
  const passwordHash = await hashPassword(password);

  const [existing] = await db.select(recipientColumns).from(users).where(eq(users.email, email));
  if (existing) {
    await sendEmail({ to: email, ...(await emails.accountExists(existing.firstName ?? existing.name)) });
  } else {
    const [user] = await db
      .insert(users)
      .values({ name: `${firstName} ${lastName}`, firstName, lastName, email, passwordHash, role: 'reader', status: 'active' })
      .onConflictDoNothing({ target: users.email })
      .returning(recipientColumns);
    if (user) await sendVerification(user);
  }

  return c.json({ message: 'Check your email to confirm your account.' }, 202);
});

readers.post('/verify-email', rateLimit({ windowMs: FIFTEEN_MINUTES, max: 20 }), validateJson(tokenSchema), async (c) => {
  const userId = await consumeUserToken(c.req.valid('json').token, 'verify_email');
  if (!userId) return c.json({ error: INVALID_LINK, code: INVALID_LINK_CODE }, 400);

  const [user] = await db
    .update(users)
    .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
    .where(eq(users.id, userId))
    .returning({ id: users.id, status: users.status });

  if (user?.status === 'active') await startSession(c, user.id);
  return c.json({ ok: true });
});

readers.post('/resend-verification', requireAuth, rateLimit({ windowMs: FIFTEEN_MINUTES, max: 3 }), async (c) => {
  const [user] = await db
    .select(recipientColumns)
    .from(users)
    .where(and(eq(users.id, c.get('user').id), isNull(users.emailVerifiedAt)));

  if (user) await sendVerification(user);
  return c.json({ ok: true });
});

readers.post('/forgot-password', rateLimit({ windowMs: FIFTEEN_MINUTES, max: 5 }), validateJson(forgotSchema), async (c) => {
  const { email } = c.req.valid('json');
  const [user] = await db
    .select({ ...recipientColumns, status: users.status })
    .from(users)
    .where(eq(users.email, email));

  if (user?.status === 'active') {
    const token = await issueUserToken(user.id, 'reset_password', RESET_PASSWORD_TTL);
    await sendEmail({ to: user.email, ...(await emails.resetPassword(user.firstName ?? user.name, token)) });
  }

  return c.json({ message: 'If an account exists for that email, a reset link is on its way.' }, 202);
});

readers.post('/reset-password', rateLimit({ windowMs: FIFTEEN_MINUTES, max: 10 }), validateJson(resetSchema), async (c) => {
  const { token, password } = c.req.valid('json');
  const passwordHash = await hashPassword(password);

  const userId = await consumeUserToken(token, 'reset_password');
  if (!userId) return c.json({ error: INVALID_LINK, code: INVALID_LINK_CODE }, 400);

  await db
    .update(users)
    .set({ passwordHash, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
    .where(eq(users.id, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await startSession(c, userId);

  return c.json({ ok: true });
});

export default readers;