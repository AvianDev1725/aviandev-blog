import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { adminOverview } from '../src/data/ask.js';
import { db } from '../src/db/index.js';
import { askEvents, posts, postSections, users } from '../src/db/schema.js';
import { cookieFor, resetDb, send } from './helpers.js';

const BROWSER = 'Mozilla/5.0 (Macintosh) Chrome/155.0 Safari/537.36';

const SETTINGS = {
  enabled: true,
  adminEnabled: true,
  provider: 'pretend',
  model: 'pretend',
  baseUrl: '',
  dailyLimit: 100,
  perReaderLimit: 20,
  answerLength: 'medium',
  creativity: 2,
};

let superAdmin: string;
let admin: string;
let adminId: number;

async function addPost(slug: string, published: boolean, authorId: number) {
  const [post] = await db
    .insert(posts)
    .values({ title: slug, slug, published, publishedAt: published ? new Date() : null, authorId })
    .returning({ id: posts.id });
  await db.insert(postSections).values({
    postId: post.id,
    position: 0,
    anchor: '',
    heading: '',
    content: 'Notes about fragment shaders in Three.js.',
    contentHash: slug,
  });
}

beforeEach(async () => {
  await resetDb();
  superAdmin = await cookieFor('super_admin');
  admin = await cookieFor('admin');
  const [superUser] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'super_admin'));
  const [adminUser] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
  adminId = adminUser.id;

  await addPost('published-shaders', true, superUser.id);
  await addPost('admin-draft', false, adminUser.id);
  await addPost('super-admin-draft', false, superUser.id);
});

const configure = (settings: object = SETTINGS) => send('PUT', '/assistant/settings', superAdmin, settings);

function events(text: string) {
  return text
    .split('\n\n')
    .filter((block) => block.trim())
    .map((block) => ({
      event: /^event: (.*)$/m.exec(block)?.[1],
      data: JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? 'null'),
    }));
}

async function sourceUrls(res: Response) {
  const sources = events(await res.text()).find((item) => item.event === 'sources')?.data ?? [];
  return sources.map((source: { url: string }) => source.url).sort();
}

describe('drafts stay private', () => {
  it('never shows drafts in blog search', async () => {
    const res = await app.request('/search?q=fragment%20shaders');
    const data = await res.json();
    expect(data.results.map((result: { url: string }) => result.url)).toEqual(['/posts/published-shaders']);
  });

  it('never uses drafts for readers', async () => {
    await configure();
    const res = await app.request('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': BROWSER },
      body: JSON.stringify({ question: 'fragment shaders' }),
    });
    expect(await sourceUrls(res)).toEqual(['/posts/published-shaders']);
  });
});

describe('admin bot', () => {
  it('needs a login and its own switch', async () => {
    expect((await send('POST', '/assistant/ask', undefined, { question: 'fragment shaders' })).status).toBe(401);

    await configure({ ...SETTINGS, adminEnabled: false });
    const res = await send('POST', '/assistant/ask', superAdmin, { question: 'fragment shaders' });
    expect(res.status).toBe(503);
    expect(await (await send('GET', '/assistant/config', admin)).json()).toEqual({ enabled: false });
  });

  it('lets super admins see every post, including drafts', async () => {
    await configure();
    const res = await send('POST', '/assistant/ask', superAdmin, { question: 'fragment shaders' });
    expect(await sourceUrls(res)).toEqual(['/posts/admin-draft', '/posts/published-shaders', '/posts/super-admin-draft']);
  });

  it('shows admins published posts and only their own drafts', async () => {
    await configure();
    const res = await send('POST', '/assistant/ask', admin, { question: 'fragment shaders' });
    expect(await sourceUrls(res)).toEqual(['/posts/admin-draft', '/posts/published-shaders']);
  });

  it('logs staff questions separately from readers', async () => {
    await configure();
    await (await send('POST', '/assistant/ask', admin, { question: 'fragment shaders' })).text();
    const [row] = await db.select().from(askEvents);
    expect(row).toMatchObject({ audience: 'staff', visitor: `staff-${adminId}` });
  });

  it('gives the bot an overview that matches what each person can see', async () => {
    expect(await adminOverview({ includeDrafts: true })).toContain('Published posts: 1. Drafts: 2.');
    expect(await adminOverview({ includeDrafts: true, authorId: adminId })).toContain('Published posts: 1. Drafts: 1.');
  });
});