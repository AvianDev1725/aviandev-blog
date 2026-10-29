import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { engineName } from '../src/data/analytics.js';
import { db } from '../src/db/index.js';
import { comments, pageVisits, posts, users } from '../src/db/schema.js';
import { cookieFor, resetDb, send } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;

let superAdmin: string;
let postId: number;

type Visit = Partial<typeof pageVisits.$inferInsert>;
const visit = (row: Visit = {}) => db.insert(pageVisits).values({ id: randomUUID(), path: '/', visitor: 'v1', ...row });
const get = async (path: string) => (await send('GET', path, superAdmin)).json();

beforeEach(async () => {
  await resetDb();
  superAdmin = await cookieFor('super_admin');
  const [post] = await db
    .insert(posts)
    .values({ title: 'GSAP timelines', slug: 'gsap-timelines', published: true, publishedAt: new Date() })
    .returning({ id: posts.id });
  postId = post.id;
  await db.insert(posts).values({ title: 'Draft', slug: 'draft', published: false });

  await visit({ visitor: 'v1', landing: true, source: 'direct', device: 'desktop' });
  await visit({ visitor: 'v1', path: '/posts/gsap-timelines', postId, readDepth: 60 });
  await visit({
    visitor: 'v2',
    path: '/posts/gsap-timelines',
    postId,
    landing: true,
    source: 'organic',
    referrerHost: 'google.co.in',
    device: 'phone',
    returning: true,
    signedIn: true,
    readDepth: 80,
  });
  await visit({ visitor: 'v3', landing: true, source: 'referral', referrerHost: 'dev.to', device: 'phone' });
  await visit({ visitor: 'old', landing: true, source: 'direct', createdAt: new Date(Date.now() - 8 * DAY) });
});

describe('analytics', () => {
  it('is for super admins only', async () => {
    const admin = await cookieFor('admin');
    expect((await send('GET', '/insights/overview', admin)).status).toBe(403);
    expect((await send('GET', '/insights/traffic')).status).toBe(401);
  });

  it('summarises the period and compares it with the one before', async () => {
    const data = await get('/insights/overview?days=7');
    const total = (values: number[]) => values.reduce((a, b) => a + b, 0);

    expect(data.dates).toHaveLength(7);
    expect(total(data.kpis.visitors.values)).toBe(3);
    expect(data.kpis.visitors.previous).toBe(1);
    expect(total(data.kpis.views.values)).toBe(4);
    expect(total(data.kpis.returning.values)).toBe(1);
    expect(data.topPosts[0]).toMatchObject({ title: 'GSAP timelines', views: 2, visitors: 2, readThrough: 70 });
  });

  it('breaks traffic down by source, search engine, site, device and sign-in', async () => {
    const data = await get('/insights/traffic?days=7');

    expect(data.sources).toEqual(
      expect.arrayContaining([
        { source: 'direct', visits: 1 },
        { source: 'organic', visits: 1 },
        { source: 'referral', visits: 1 },
      ]),
    );
    expect(data.engines).toEqual([{ name: 'Google', visits: 1 }]);
    expect(data.referrers).toEqual([{ host: 'dev.to', visits: 1 }]);
    expect(data.devices).toEqual(expect.arrayContaining([{ device: 'phone', visits: 2 }]));
    expect(data.signedIn).toEqual({ readers: 1, guests: 2 });
    expect(data.pages[0]).toMatchObject({ path: '/', views: 2 });
  });

  it('shows posts, read-through and approved comments only', async () => {
    await db.insert(comments).values([
      { postId, body: 'Great post', status: 'approved', guestAvatar: 'owl' },
      { postId, body: 'Waiting', status: 'pending', guestAvatar: 'owl' },
    ]);
    const data = await get('/insights/content?days=7');

    expect(data.counts).toEqual({ total: 2, published: 1, drafts: 1 });
    expect(data.posts[0]).toMatchObject({ title: 'GSAP timelines', readThrough: 70, comments: 1 });
    expect(data.mostCommented[0]).toMatchObject({ title: 'GSAP timelines', comments: 1 });
  });

  it('counts readers, the team and signed-in visitors', async () => {
    await db.insert(users).values([
      { name: 'Asha', email: 'asha@example.com', passwordHash: 'x', role: 'reader', status: 'active', emailVerifiedAt: new Date() },
      { name: 'Ravi', email: 'ravi@example.com', passwordHash: 'x', role: 'reader', status: 'active' },
      { name: 'Mia', email: 'mia@example.com', passwordHash: 'x', role: 'reader', status: 'active', bannedAt: new Date() },
    ]);
    const data = await get('/insights/people?days=7');

    expect(data.counts).toMatchObject({ readers: 3, verified: 1, notVerified: 2, banned: 1, superAdmins: 1, signedInVisitors: 1 });
    expect(data.signups.values.reduce((a: number, b: number) => a + b, 0)).toBe(3);
  });

  it('groups search engines by name', () => {
    expect(engineName('google.co.in')).toBe('Google');
    expect(engineName('www.bing.com')).toBe('Bing');
    expect(engineName('search.example')).toBe('search.example');
  });
});