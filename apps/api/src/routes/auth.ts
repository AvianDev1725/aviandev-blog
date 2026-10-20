import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit } from '../middleware/rate-limit.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { sendEmail, emails } from '../lib/email.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { getSessionUser, deleteSession, SESSION_COOKIE } from '../lib/session.js';
import { validateJson } from '../lib/validate.js';
import { nameField, emailField, passwordField } from '../schemas/user.js';
import { startSession } from '../lib/session-cookie.js';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({ name: nameField, email: emailField, password: passwordField });

const dummyHash = await hashPassword('dummy-password-for-timing');

async function notifySuperAdmins(name: string, email: string) {
  try {
    const superAdmins = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.role, 'super_admin'), eq(users.status, 'active')));

    if (superAdmins.length > 0) {
        await sendEmail({ to: superAdmins.map((u) => u.email), ...(await emails.newSignup(name, email)) });
    }
  } catch (err) {
    console.error('[notify super admins failed]', err);
  }
}

const auth = new Hono();

auth.post('/login', validateJson(loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const [user] = await db.select().from(users).where(eq(users.email, email));

  const passwordOk = await verifyPassword(user?.passwordHash ?? dummyHash, password);
  if (!user || !passwordOk || user.status !== 'active') {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  await startSession(c, user.id);

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    },
  });
});

auth.post(
  '/signup',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),
  validateJson(signupSchema),
  async (c) => {
    const { name, email, password } = c.req.valid('json');
    const passwordHash = await hashPassword(password);

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!existing) {
      await db.insert(users).values({ name, email, passwordHash, role: 'admin', status: 'pending' });
      void notifySuperAdmins(name, email);
    }

    return c.json({ message: "Request received. You'll be able to sign in once it's approved." }, 202);
  }
);

auth.get('/me', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  const user = token ? await getSessionUser(token) : null;
  if (!user) return c.json({ error: 'Not logged in' }, 401);
  return c.json({ user });
});

auth.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await deleteSession(token);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.body(null, 204);
});

export default auth;