import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { pageVisits, posts } from '../src/db/schema.js';
import { classifySource, deviceFrom } from '../src/lib/traffic.js';
import { resetDb } from './helpers.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/155.0 Safari/537.36';

const visit = (body: object, userAgent = IPHONE) =>
  app.request('/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': userAgent, 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify({ landing: true, returning: false, signedIn: false, ...body }),
  });

beforeEach(async () => {
  await resetDb();
  await db.insert(posts).values({ title: 'GSAP timelines', slug: 'gsap-timelines', published: true, publishedAt: new Date() });
});

describe('sources and devices', () => {
  it('sorts visitors by where they came from', () => {
    expect(classifySource({ landing: true, referrer: 'https://www.google.co.in/' })).toEqual({ source: 'organic', host: 'google.co.in' });
    expect(classifySource({ landing: true, referrer: 'https://t.co/abc' }).source).toBe('social');
    expect(classifySource({ landing: true, referrer: 'https://dev.to/some-post' })).toEqual({ source: 'referral', host: 'dev.to' });
    expect(classifySource({ landing: true }).source).toBe('direct');
    expect(classifySource({ landing: true, utmSource: 'LinkedIn' }).source).toBe('social');
    expect(classifySource({ landing: false, referrer: 'https://google.com' }).source).toBe('internal');
  });

  it('works out the device', () => {
    expect(deviceFrom(IPHONE)).toBe('phone');
    expect(deviceFrom(MAC)).toBe('desktop');
    expect(deviceFrom('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe('tablet');
    expect(deviceFrom('Mozilla/5.0 (Linux; Android 15; SM-X710) Chrome/155.0 Safari/537.36')).toBe('tablet');
  });
});

describe('recording visits', () => {
  it('saves a visit with its post, source and device', async () => {
    const res = await visit({ id: 'visit-0001', path: '/posts/gsap-timelines', referrer: 'https://www.google.com/' });
    expect(res.status).toBe(204);

    const [row] = await db.select().from(pageVisits);
    expect(row).toMatchObject({ path: '/posts/gsap-timelines', source: 'organic', referrerHost: 'google.com', device: 'phone', landing: true });
    expect(row.postId).not.toBeNull();
    expect(row.visitor).not.toContain('203.0.113.9');
  });

  it('ignores bots, refuses odd paths and counts each visit once', async () => {
    await visit({ id: 'visit-0002', path: '/' }, 'Googlebot/2.1');
    expect(await db.select().from(pageVisits)).toHaveLength(0);

    expect((await visit({ id: 'visit-0003', path: 'https://spam.example' })).status).toBe(400);

    await visit({ id: 'visit-0004', path: '/' });
    await visit({ id: 'visit-0004', path: '/' });
    expect(await db.select().from(pageVisits)).toHaveLength(1);
  });

  it('only ever raises read-through', async () => {
    await visit({ id: 'visit-0005', path: '/posts/gsap-timelines' });
    const depth = (value: number) =>
      app.request('/track/depth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'visit-0005', depth: value }) });

    await depth(70);
    await depth(40);
    const [row] = await db.select().from(pageVisits);
    expect(row.readDepth).toBe(70);
  });
});