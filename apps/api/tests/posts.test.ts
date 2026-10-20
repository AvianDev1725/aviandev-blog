import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { posts, users } from '../src/db/schema.js';
import { cookieFor, send, resetDb } from './helpers.js';

let admin: string;

beforeEach(async () => {
  await resetDb();
  admin = await cookieFor('admin');
});

const create = (body: object, cookie = admin) => send('POST', '/posts', cookie, body);

describe('POST /posts', () => {
  it('creates a post as an admin, with them as author', async () => {
    const res = await create({ title: 'Test', slug: 'test', published: true });
    expect(res.status).toBe(201);

    const [row] = await db.select().from(posts);
    expect(row.slug).toBe('test');
    expect(row.authorId).toBeTypeOf('number');
  });

  it('returns 401 when not logged in', async () => {
    const res = await send('POST', '/posts', undefined, { title: 'X', slug: 'x' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for a reader', async () => {
    const reader = await cookieFor('reader');
    const res = await create({ title: 'X', slug: 'x' }, reader);
    expect(res.status).toBe(403);
  });
});

describe('GET /posts', () => {
  it('lists only published posts, without logging in', async () => {
    await create({ title: 'Live', slug: 'live', published: true });
    await create({ title: 'Draft', slug: 'draft', published: false });

    const list = await (await app.request('/posts')).json();
    expect(list).toHaveLength(1);
    expect(list[0].slug).toBe('live');
  });
});

describe('GET /posts/:slug', () => {
  it('returns a published post', async () => {
    await create({ title: 'Live', slug: 'live', published: true });
    expect((await app.request('/posts/live')).status).toBe(200);
  });

  it('returns 404 for a draft', async () => {
    await create({ title: 'Draft', slug: 'draft', published: false });
    expect((await app.request('/posts/draft')).status).toBe(404);
  });
});

describe('PATCH /posts/:id', () => {
  it('lets an admin update their own post', async () => {
    const created = await (await create({ title: 'Old', slug: 'old' })).json();
    const res = await send('PATCH', `/posts/${created.id}`, admin, { title: 'New' });

    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe('New');
  });

  it("blocks an admin from editing someone else's post", async () => {
    const created = await (await create({ title: 'Mine', slug: 'mine' })).json();
    const other = await cookieFor('admin', 'other@test.com');

    const res = await send('PATCH', `/posts/${created.id}`, other, { title: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('lets a super admin edit any post', async () => {
    const created = await (await create({ title: 'Mine', slug: 'mine' })).json();
    const superAdmin = await cookieFor('super_admin');

    const res = await send('PATCH', `/posts/${created.id}`, superAdmin, { title: 'Fixed' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /posts/:id', () => {
  it('deletes a post, then returns 404', async () => {
    const created = await (await create({ title: 'Bye', slug: 'bye' })).json();

    expect((await send('DELETE', `/posts/${created.id}`, admin)).status).toBe(204);
    expect((await send('DELETE', `/posts/${created.id}`, admin)).status).toBe(404);
  });

  it('returns 400 for an invalid id', async () => {
    expect((await send('DELETE', '/posts/abc', admin)).status).toBe(400);
  });
});

describe('validation', () => {
  it('rejects a post without a title', async () => {
    expect((await create({ slug: 'no-title' })).status).toBe(400);
  });

  it('rejects an invalid slug', async () => {
    expect((await create({ title: 'Bad', slug: 'Bad Slug!' })).status).toBe(400);
  });

  it('rejects an empty update', async () => {
    const created = await (await create({ title: 'X', slug: 'x' })).json();
    const res = await send('PATCH', `/posts/${created.id}`, admin, {});
    expect(res.status).toBe(400);
  });

  it('returns a clean error format', async () => {
    const body = await (await create({ title: 'No slug' })).json();
    expect(body.error).toBe('Validation failed');
    expect(body.details[0].field).toBe('slug');
  });

  it('returns 409 for a duplicate slug', async () => {
    await create({ title: 'First', slug: 'same' });
    expect((await create({ title: 'Second', slug: 'same' })).status).toBe(409);
  });
});

describe('content and dates', () => {
  it('stores content and an excerpt', async () => {
    const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }] };
    const post = await (await create({ title: 'Rich', slug: 'rich', excerpt: 'A short summary', content })).json();

    expect(post.excerpt).toBe('A short summary');
    expect(post.content).toEqual(content);
  });

  it('gives new posts an empty document by default', async () => {
    const post = await (await create({ title: 'Empty', slug: 'empty' })).json();
    expect(post.content).toEqual({ type: 'doc', content: [] });
  });

  it('rejects content that is not a document', async () => {
    const res = await create({ title: 'Bad', slug: 'bad', content: { type: 'html' } });
    expect(res.status).toBe(400);
  });

  it('sets publishedAt on first publish and keeps it after republishing', async () => {
    const draft = await (await create({ title: 'Later', slug: 'later' })).json();
    expect(draft.publishedAt).toBeNull();

    const first = await (await send('PATCH', `/posts/${draft.id}`, admin, { published: true })).json();
    expect(first.publishedAt).not.toBeNull();

    await send('PATCH', `/posts/${draft.id}`, admin, { published: false });
    const again = await (await send('PATCH', `/posts/${draft.id}`, admin, { published: true })).json();
    expect(again.publishedAt).toBe(first.publishedAt);
  });

  it('updates updatedAt on every change', async () => {
    const created = await (await create({ title: 'Old', slug: 'old' })).json();
    await send('PATCH', `/posts/${created.id}`, admin, { title: 'New' });

    const [row] = await db.select().from(posts).where(eq(posts.id, created.id));
    expect(row.title).toBe('New');
    expect(row.updatedAt.getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());
  });
});

describe('public reading', () => {
  it('leaves content out of the list, but includes it and the author on the post', async () => {
    const content = { type: 'doc', content: [] };
    await create({ title: 'A', slug: 'a', published: true, content });

    const [item] = await (await app.request('/posts')).json();
    expect(item.content).toBeUndefined();

    const post = await (await app.request('/posts/a')).json();
    expect(post.content).toEqual(content);
    expect(post.authorName).toBe('Test User');
  });
});

describe('SEO fields', () => {
  it('defaults to empty values', async () => {
    const post = await (await create({ title: 'Plain', slug: 'plain' })).json();
    expect(post).toMatchObject({ seoTitle: '', seoDescription: '', shareImage: '', noindex: false });
  });

  it('saves SEO fields', async () => {
    const created = await (await create({ title: 'A', slug: 'a' })).json();
    const res = await send('PATCH', `/posts/${created.id}`, admin, {
      seoTitle: 'Better title',
      seoDescription: 'A description for search results.',
      shareImage: '/media/abc.png',
      noindex: true,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ seoTitle: 'Better title', shareImage: '/media/abc.png', noindex: true });
  });

  it('rejects unsafe share images and over-long titles', async () => {
    expect((await create({ title: 'A', slug: 'a', shareImage: 'javascript:alert(1)' })).status).toBe(400);
    expect((await create({ title: 'B', slug: 'b', seoTitle: 'x'.repeat(71) })).status).toBe(400);
  });
});