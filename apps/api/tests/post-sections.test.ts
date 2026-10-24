import { describe, it, expect, beforeEach } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { postSections } from '../src/db/schema.js';
import { cookieFor, resetDb, send } from './helpers.js';

let admin: string;

beforeEach(async () => {
  await resetDb();
  admin = await cookieFor('admin');
});

const content = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Intro text.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Using cacheLife' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Keeps data fresh.' }] },
  ],
};

const sectionsFor = (postId: number) =>
  db.select().from(postSections).where(eq(postSections.postId, postId)).orderBy(asc(postSections.position));

describe('post sections', () => {
  it('indexes a post when it is published', async () => {
    const post = await (await send('POST', '/posts', admin, { title: 'Caching', slug: 'caching', published: true, content })).json();
    const sections = await sectionsFor(post.id);
    expect(sections.map((section) => section.anchor)).toEqual(['', 'using-cachelife']);
  });

  it("doesn't index drafts", async () => {
    const post = await (await send('POST', '/posts', admin, { title: 'Draft', slug: 'draft', content })).json();
    expect(await sectionsFor(post.id)).toHaveLength(0);
  });

  it('removes sections when a post is unpublished or hidden', async () => {
    const post = await (await send('POST', '/posts', admin, { title: 'Caching', slug: 'caching', published: true, content })).json();

    await send('PATCH', `/posts/${post.id}`, admin, { published: false });
    expect(await sectionsFor(post.id)).toHaveLength(0);

    await send('PATCH', `/posts/${post.id}`, admin, { published: true, noindex: true });
    expect(await sectionsFor(post.id)).toHaveLength(0);
  });

  it('updates sections when the content changes', async () => {
    const post = await (await send('POST', '/posts', admin, { title: 'Caching', slug: 'caching', published: true, content })).json();
    const updated = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Using cacheTag' }] }],
    };
    await send('PATCH', `/posts/${post.id}`, admin, { content: updated });
    expect((await sectionsFor(post.id)).map((section) => section.anchor)).toEqual(['using-cachetag']);
  });
});