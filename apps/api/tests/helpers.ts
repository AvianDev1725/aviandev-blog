import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { categories, invitations, posts, users, contentModels, contentFragments, media, postViews, viewVisitors, userTokens, comments, searchEvents, dismissedSearches } from '../src/db/schema.js';
import { hashPassword } from '../src/lib/password.js';

export const PASSWORD = 'test-password-123';
type Role = 'reader' | 'admin' | 'super_admin';

export async function createUser(email: string, role: Role = 'admin', status: 'active' | 'pending' = 'active') {
  const [user] = await db
    .insert(users)
    .values({ name: 'Test User', email, passwordHash: await hashPassword(PASSWORD), role, status })
    .returning();
  return user;
}

export async function loginAs(email: string) {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return res.headers.get('set-cookie')!.split(';')[0];
}

export async function cookieFor(role: Role, email = `${role}@test.com`) {
  await createUser(email, role);
  return loginAs(email);
}

export function send(method: string, path: string, cookie?: string, body?: object) {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function resetDb() {
  await db.delete(searchEvents);
  await db.delete(dismissedSearches);
  await db.delete(media);
  await db.delete(invitations);
  await db.delete(contentFragments);
  await db.delete(contentModels);
  await db.delete(posts);
  await db.delete(categories);
  await db.delete(users);
  await db.delete(viewVisitors);
  await db.delete(postViews);
  await db.delete(userTokens);
  await db.delete(comments);
}