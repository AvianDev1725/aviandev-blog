import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { viewVisitors } from '../src/db/schema.js';
import { cookieFor, resetDb, send } from './helpers.js';

const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/155.0 Safari/537.36';

let admin: string;

beforeEach(async () => {
  await resetDb();
  admin = await cookieFor('admin');
});

function view(slug: string, ip = '203.0.113.1', userAgent = BROWSER) {
  return app.request(`/views/${slug}`, {
    method: 'POST',
    headers: { 'user-agent': userAgent, 'x-forwarded-for': ip },
  });
}

async function publish(slug = 'hello') {
  return (await send('POST', '/posts', admin, { title: 'Hello', slug, published: true })).json();
}

describe('view counts', () => {
  it('counts a first visit and returns the total', async () => {
    await publish();
    const res = await view('hello');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ views: 1 });
  });

  it('counts the same visitor once per day', async () => {
    await publish();
    await view('hello');
    expect(await (await view('hello')).json()).toEqual({ views: 1 });
  });

  it('counts different visitors separately', async () => {
    await publish();
    await view('hello', '203.0.113.1');
    expect(await (await view('hello', '203.0.113.2')).json()).toEqual({ views: 2 });
  });

  it("doesn't count bots, but still returns the total", async () => {
    await publish();
    await view('hello');
    const res = await view('hello', '198.51.100.9', 'Googlebot/2.1 (+http://www.google.com/bot.html)');
    expect(await res.json()).toEqual({ views: 1 });
  });

  it("doesn't count drafts", async () => {
    await send('POST', '/posts', admin, { title: 'Draft', slug: 'draft' });
    expect((await view('draft')).status).toBe(404);
  });

  it('deletes fingerprints from earlier days', async () => {
    await publish();
    await db.insert(viewVisitors).values({ hash: 'old', day: '2000-01-01' });
    await view('hello');
    const remaining = await db.select().from(viewVisitors);
    expect(remaining.map((row) => row.hash)).not.toContain('old');
  });

  it('includes view totals in the public post list', async () => {
    await publish();
    await view('hello');
    const list = await (await app.request('/posts')).json();
    expect(list[0].views).toBe(1);
  });
});