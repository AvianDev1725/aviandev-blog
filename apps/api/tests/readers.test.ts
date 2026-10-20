import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { userTokens, users } from '../src/db/schema.js';
import { issueUserToken } from '../src/lib/user-tokens.js';
import { cookieFor, createUser, PASSWORD, resetDb, send } from './helpers.js';

const NEW_PASSWORD = 'a-brand-new-password-456';

beforeEach(async () => {
  await resetDb();
});

const signup = (email = 'reader@test.com', password = PASSWORD) =>
  send('POST', '/readers/signup', undefined, { firstName: 'Asha', lastName: 'Rao', email, password });

const cookieFrom = (res: Response) => res.headers.get('set-cookie')?.split(';')[0];

async function findUser(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

describe('reader sign-up', () => {
  it('creates an active, unconfirmed reader and a confirmation link', async () => {
    expect((await signup()).status).toBe(202);

    const user = await findUser('reader@test.com');
    expect(user).toMatchObject({ role: 'reader', status: 'active', firstName: 'Asha', lastName: 'Rao', name: 'Asha Rao' });
    expect(user.emailVerifiedAt).toBeNull();

    const tokens = await db.select().from(userTokens).where(eq(userTokens.userId, user.id));
    expect(tokens).toHaveLength(1);
    expect(tokens[0].purpose).toBe('verify_email');
  });

  it("gives the same answer for an existing email, and doesn't change that account", async () => {
    await createUser('taken@test.com', 'admin');
    const res = await signup('taken@test.com', NEW_PASSWORD);
    expect(res.status).toBe(202);

    const user = await findUser('taken@test.com');
    expect(user.role).toBe('admin');
    const login = await send('POST', '/auth/login', undefined, { email: 'taken@test.com', password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('lets a reader log in before confirming', async () => {
    await signup();
    const login = await send('POST', '/auth/login', undefined, { email: 'reader@test.com', password: PASSWORD });
    expect(login.status).toBe(200);
    expect((await login.json()).user.emailVerified).toBe(false);
  });
});

describe('confirming email', () => {
  it('confirms the email and logs the reader in', async () => {
    await signup();
    const user = await findUser('reader@test.com');
    const token = await issueUserToken(user.id, 'verify_email', 60_000);

    const res = await send('POST', '/readers/verify-email', undefined, { token });
    expect(res.status).toBe(200);
    const cookie = cookieFrom(res);
    expect(cookie).toBeTruthy();

    const me = await (await send('GET', '/auth/me', cookie)).json();
    expect(me.user.emailVerifiedAt).not.toBeNull();
  });

  it('only works once', async () => {
    const user = await createUser('reader@test.com', 'reader');
    const token = await issueUserToken(user.id, 'verify_email', 60_000);
    await send('POST', '/readers/verify-email', undefined, { token });
    expect((await send('POST', '/readers/verify-email', undefined, { token })).status).toBe(400);
  });

  it('rejects expired links', async () => {
    const user = await createUser('reader@test.com', 'reader');
    const token = await issueUserToken(user.id, 'verify_email', -1000);
    expect((await send('POST', '/readers/verify-email', undefined, { token })).status).toBe(400);
  });

  it("doesn't accept a password reset link", async () => {
    const user = await createUser('reader@test.com', 'reader');
    const token = await issueUserToken(user.id, 'reset_password', 60_000);
    expect((await send('POST', '/readers/verify-email', undefined, { token })).status).toBe(400);
  });

  it('cancels older links when a new one is sent', async () => {
    const user = await createUser('reader@test.com', 'reader');
    const first = await issueUserToken(user.id, 'verify_email', 60_000);
    await issueUserToken(user.id, 'verify_email', 60_000);
    expect((await send('POST', '/readers/verify-email', undefined, { token: first })).status).toBe(400);
  });
});

describe('password reset', () => {
  it('gives the same answer whether or not the email exists', async () => {
    const res = await send('POST', '/readers/forgot-password', undefined, { email: 'nobody@test.com' });
    expect(res.status).toBe(202);
  });

  it('sets a new password and logs out other sessions', async () => {
    const oldSession = await cookieFor('reader');
    const [user] = await db.select().from(users).where(eq(users.email, 'reader@test.com'));
    const token = await issueUserToken(user.id, 'reset_password', 60_000);

    const res = await send('POST', '/readers/reset-password', undefined, { token, password: NEW_PASSWORD });
    expect(res.status).toBe(200);

    expect((await send('GET', '/auth/me', oldSession)).status).toBe(401);
    expect((await send('GET', '/auth/me', cookieFrom(res))).status).toBe(200);

    const oldLogin = await send('POST', '/auth/login', undefined, { email: 'reader@test.com', password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await send('POST', '/auth/login', undefined, { email: 'reader@test.com', password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
  });
});

describe('readers and the admin', () => {
  it("can't use any admin routes", async () => {
    const reader = await cookieFor('reader');
    const attempts = [
      send('GET', '/admin/posts', reader),
      send('POST', '/posts', reader, { title: 'Sneaky', slug: 'sneaky' }),
      send('POST', '/categories', reader, { name: 'Sneaky', slug: 'sneaky' }),
      send('GET', '/users', reader),
      send('POST', '/content-models', reader, { key: 'sneaky', name: 'Sneaky', fields: [] }),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(403);
  });
});