import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { askEvents, posts, postSections } from '../src/db/schema.js';
import { cookieFor, resetDb, send } from './helpers.js';

const URL = '/posts/gsap-timelines#why-timelines';

let superAdmin: string;

type Row = Partial<typeof askEvents.$inferInsert>;

const ask = (row: Row = {}) =>
  db.insert(askEvents).values({
    id: randomUUID(),
    question: 'gsap timeline',
    visitor: 'reader-1',
    status: 'answered',
    provider: 'pretend',
    model: 'pretend',
    ...row,
  });

const insights = async (cookie = superAdmin) => (await send('GET', '/insights/ask?days=7', cookie)).json();

beforeEach(async () => {
  await resetDb();
  superAdmin = await cookieFor('super_admin');

  const [post] = await db
    .insert(posts)
    .values({ title: 'GSAP timelines', slug: 'gsap-timelines', published: true, publishedAt: new Date() })
    .returning({ id: posts.id });
  await db.insert(postSections).values({
    postId: post.id,
    position: 0,
    anchor: 'why-timelines',
    heading: 'Why timelines',
    content: 'A GSAP timeline lines up tweens.',
    contentHash: 'why',
  });
});

describe('ask insights', () => {
  it('is for super admins only', async () => {
    const admin = await cookieFor('admin');
    expect((await send('GET', '/insights/ask', admin)).status).toBe(403);
    expect((await send('GET', '/insights/ask')).status).toBe(401);
  });

  it('counts reader questions, answers and feedback, but not staff questions', async () => {
    await ask({ helpful: true, citedUrls: [URL] });
    await ask({ helpful: false });
    await ask({ status: 'not_found', question: 'bake sourdough' });
    await ask({ status: 'error' });
    await ask({ audience: 'staff', visitor: 'staff-1' });

    const data = await insights();
    expect(data.totals).toEqual({ questions: 4, answered: 2, notFound: 1, errors: 1, helpful: 1, notHelpful: 1 });
    expect(data.perDay).toHaveLength(7);
    expect(data.perDay.at(-1).questions).toBe(4);
  });

  it('lists unanswered questions until they are dismissed', async () => {
    await ask({ status: 'not_found', question: 'bake sourdough' });
    await ask({ status: 'not_found', question: 'bake sourdough' });
    await ask({ status: 'not_found', question: 'three.js shaders' });

    const data = await insights();
    expect(data.unanswered.map((row: { question: string }) => row.question)).toEqual(['bake sourdough', 'three.js shaders']);
    expect(data.unanswered[0].times).toBe(2);

    await send('POST', '/insights/search/dismiss', superAdmin, { query: 'Bake Sourdough' });
    expect((await insights()).unanswered.map((row: { question: string }) => row.question)).toEqual(['three.js shaders']);
  });

  it('shows which sections answers used most', async () => {
    await ask({ citedUrls: [URL] });
    await ask({ citedUrls: [URL] });

    const [section] = (await insights()).sections;
    expect(section).toMatchObject({ url: URL, times: 2, postTitle: 'GSAP timelines', heading: 'Why timelines' });
  });

  it('deletes questions older than 30 days', async () => {
    await ask({ createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) });
    await insights();
    expect(await db.select().from(askEvents)).toHaveLength(0);
  });
});