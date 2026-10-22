import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/app.js';
import { cookieFor, resetDb, send } from './helpers.js';

let admin: string;

beforeEach(async () => {
  await resetDb();
  admin = await cookieFor('admin');
});

async function topic(name: string) {
  return (await (await send('POST', '/categories', admin, { name, slug: name.toLowerCase() })).json()).id as number;
}

async function publish(slug: string, categoryIds: number[] = [], extra: object = {}) {
  await send('POST', '/posts', admin, { title: slug, slug, published: true, categoryIds, ...extra });
}

const related = async (slug: string) => (await (await app.request(`/related/${slug}`)).json()).map((post: { slug: string }) => post.slug);

describe('related posts', () => {
  it('puts posts with the most shared topics first', async () => {
    const gsap = await topic('GSAP');
    const next = await topic('Next');
    const css = await topic('CSS');

    await publish('one-shared', [gsap]);
    await publish('two-shared', [gsap, next]);
    await publish('unrelated', [css]);
    await publish('current', [gsap, next]);

    const slugs = await related('current');
    expect(slugs.slice(0, 2)).toEqual(['two-shared', 'one-shared']);
  });

  it('fills up with the latest posts when there are too few matches', async () => {
    const gsap = await topic('GSAP');
    await publish('older');
    await publish('newer');
    await publish('current', [gsap]);

    expect(await related('current')).toEqual(['newer', 'older']);
  });

  it('never includes the post itself, drafts or hidden posts', async () => {
    const gsap = await topic('GSAP');
    await publish('current', [gsap]);
    await send('POST', '/posts', admin, { title: 'draft', slug: 'draft', categoryIds: [gsap] });
    await publish('hidden', [gsap], { noindex: true });
    await publish('visible', [gsap]);

    expect(await related('current')).toEqual(['visible']);
  });

  it('returns at most three posts', async () => {
    for (const slug of ['a', 'b', 'c', 'd', 'e']) await publish(slug);
    expect(await related('a')).toHaveLength(3);
  });

  it('returns 404 for missing or unpublished posts', async () => {
    await send('POST', '/posts', admin, { title: 'draft', slug: 'draft' });
    expect((await app.request('/related/nope')).status).toBe(404);
    expect((await app.request('/related/draft')).status).toBe(404);
  });
});