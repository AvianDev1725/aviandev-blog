import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { searchEvents } from '../src/db/schema.js';
import { normalizeQuery } from '../src/data/search-insights.js';
import { cookieFor, resetDb, send } from './helpers.js';

const BROWSER = 'Mozilla/5.0 (Macintosh) Chrome/155.0 Safari/537.36';

let superAdmin: string;
let admin: string;

beforeEach(async () => {
  await resetDb();
  superAdmin = await cookieFor('super_admin');
  admin = await cookieFor('admin');
});

async function logAs(userAgent: string, body: object) {
  return app.request('/search/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': userAgent },
    body: JSON.stringify(body),
  });
}

const insights = async (cookie = superAdmin) => (await send('GET', '/insights/search?days=7', cookie)).json();

describe('recording searches', () => {
  it('lower-cases searches and hides emails and phone numbers', () => {
    expect(normalizeQuery('  ScrollTrigger   Pins ')).toBe('scrolltrigger pins');
    expect(normalizeQuery('mail asha@example.com')).toBe('mail [email]');
    expect(normalizeQuery('call +91 98765 43210')).toBe('call [number]');
  });

  it('saves a finished search', async () => {
    const res = await logAs(BROWSER, { query: 'Stagger', resultCount: 4, openedUrl: '/posts/gsap#stagger' });
    expect(res.status).toBe(204);

    const [row] = await db.select().from(searchEvents);
    expect(row).toMatchObject({ query: 'stagger', resultCount: 4, openedUrl: '/posts/gsap#stagger', progress: 100 });
  });

  it('ignores bots and rejects links that are not post sections', async () => {
    await logAs('Googlebot/2.1', { query: 'stagger', resultCount: 4 });
    expect(await db.select().from(searchEvents)).toHaveLength(0);

    const res = await logAs(BROWSER, { query: 'stagger', resultCount: 1, openedUrl: 'https://spam.example' });
    expect(res.status).toBe(400);
  });

  it('moves a search up through the levels, never down', async () => {
    const clientId = 'level12345-search';
    await logAs(BROWSER, { clientId, query: 'fromTo', resultCount: 6, progress: 0 });
    await logAs(BROWSER, { clientId, query: 'fromTo', resultCount: 6, progress: 50 });
    await logAs(BROWSER, { clientId, query: 'fromTo', resultCount: 6, openedUrl: '/posts/gsap#fromto' });
    await logAs(BROWSER, { clientId, query: 'fromTo', resultCount: 6, progress: 0 });

    const rows = await db.select().from(searchEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ progress: 100, openedUrl: '/posts/gsap#fromto' });
  });

  it('rejects levels other than 0, 50 and 100, and odd search IDs', async () => {
    expect((await logAs(BROWSER, { query: 'stagger', resultCount: 1, progress: 75 })).status).toBe(400);
    expect((await logAs(BROWSER, { clientId: 'bad id!', query: 'stagger', resultCount: 1 })).status).toBe(400);
    expect(await db.select().from(searchEvents)).toHaveLength(0);
  });
});

describe('search insights', () => {
  it('is for super admins only', async () => {
    expect((await send('GET', '/insights/search', admin)).status).toBe(403);
    expect((await send('GET', '/insights/search')).status).toBe(401);
  });

  it('summarises searches, engagement, top searches and opened sections', async () => {
    await logAs(BROWSER, { query: 'stagger', resultCount: 3, openedUrl: '/posts/gsap#stagger' });
    await logAs(BROWSER, { query: 'stagger', resultCount: 3 });
    await logAs(BROWSER, { query: 'three.js', resultCount: 0 });

    const data = await insights();
    expect(data.totals).toEqual({ searches: 3, withResults: 2, reachedResultsPage: 1, opened: 1, engagement: 33 });
    expect(data.top[0]).toMatchObject({ query: 'stagger', searches: 2, openedPercent: 50, engagement: 50 });
    expect(data.perDay).toHaveLength(7);
    expect(data.perDay.at(-1).searches).toBe(3);
  });

  it('lists searches that never found anything as content ideas', async () => {
    await logAs(BROWSER, { query: 'three.js', resultCount: 0 });
    await logAs(BROWSER, { query: 'three.js', resultCount: 0 });
    await logAs(BROWSER, { query: 'gsap', resultCount: 0 });
    await logAs(BROWSER, { query: 'gsap', resultCount: 5 });

    const ideas = (await insights()).ideas.map((idea: { query: string }) => idea.query);
    expect(ideas).toEqual(['three.js']);
  });

  it('hides dismissed ideas until readers search for them again', async () => {
    await logAs(BROWSER, { query: 'three.js', resultCount: 0 });
    await send('POST', '/insights/search/dismiss', superAdmin, { query: 'Three.js' });
    expect((await insights()).ideas).toHaveLength(0);

    await db.insert(searchEvents).values({ query: 'three.js', resultCount: 0, createdAt: new Date(Date.now() + 1000) });
    expect((await insights()).ideas).toHaveLength(1);
  });

  it('deletes searches older than 30 days', async () => {
    await db.insert(searchEvents).values({
      query: 'old',
      resultCount: 0,
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });
    await insights();
    expect(await db.select().from(searchEvents)).toHaveLength(0);
  });
});