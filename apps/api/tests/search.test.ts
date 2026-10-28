import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/app.js';
import { toSnippetParts } from '../src/data/search.js';
import { cookieFor, resetDb, send } from './helpers.js';

let admin: string;

beforeEach(async () => {
  await resetDb();
  admin = await cookieFor('admin');
});

const text = (value: string) => ({ type: 'text', text: value });
const heading = (value: string) => ({ type: 'heading', attrs: { level: 2 }, content: [text(value)] });
const paragraph = (value: string) => ({ type: 'paragraph', content: [text(value)] });
const code = (value: string) => ({ type: 'codeBlock', attrs: { language: 'ts' }, content: [text(value)] });

async function publish(slug: string, blocks: object[], extra: object = {}) {
  await send('POST', '/posts', admin, {
    title: slug,
    slug,
    published: true,
    content: { type: 'doc', content: blocks },
    ...extra,
  });
}

async function search(params: string) {
  const res = await app.request(`/search?${params}`);
  return { status: res.status, body: await res.json() };
}

describe('search', () => {
  it('finds exact names, even inside code, and links to the right heading', async () => {
    await publish('caching', [
      heading('Controlling cache time'),
      paragraph('Set how long data stays fresh.'),
      code("cacheLife('hours')"),
    ]);

    const { body } = await search('q=cacheLife');
    const [first] = body.results;
    expect(first.url).toBe('/posts/caching#controlling-cache-time');
    expect(first.matchedBy).toContain('keyword');
  });

  it('highlights the matching words in the snippet', async () => {
    await publish('timelines', [heading('Timelines'), paragraph('A timeline sequences several tweens in order.')]);

    const { body } = await search('q=sequences');
    const highlighted = body.results[0].snippet.filter((part: { highlight: boolean }) => part.highlight);
    expect(highlighted.map((part: { text: string }) => part.text.toLowerCase())).toContain('sequences');
  });

  it('understands word forms', async () => {
    await publish('motion', [heading('Basics'), paragraph('We animate elements with transforms.')]);
    expect((await search('q=animations')).body.results).toHaveLength(1);
  });

  it('tolerates typos', async () => {
    await publish('scroll', [heading('Pinning'), paragraph('ScrollTrigger pins a section while you scroll.')]);

    const { body } = await search('q=scrolltriger');
    expect(body.results[0]?.url).toBe('/posts/scroll#pinning');
    expect(body.results[0].matchedBy).toContain('typo');
  });

  it('filters by topic and lists topics in the results', async () => {
    const gsap = (await (await send('POST', '/categories', admin, { name: 'GSAP', slug: 'gsap' })).json()).id;
    const next = (await (await send('POST', '/categories', admin, { name: 'Next', slug: 'next' })).json()).id;
    await publish('gsap-timelines', [paragraph('Timelines in GSAP.')], { categoryIds: [gsap] });
    await publish('next-timelines', [paragraph('Timelines for page transitions.')], { categoryIds: [next] });

    const all = (await search('q=timelines')).body;
    expect(all.results).toHaveLength(2);
    expect(all.topics.map((topic: { slug: string }) => topic.slug).sort()).toEqual(['gsap', 'next']);

    const filtered = (await search('q=timelines&topic=gsap')).body;
    expect(filtered.results.map((result: { postSlug: string }) => result.postSlug)).toEqual(['gsap-timelines']);
  });

  it('never shows drafts', async () => {
    await send('POST', '/posts', admin, {
      title: 'Secret',
      slug: 'secret',
      content: { type: 'doc', content: [paragraph('Unreleased timelines feature.')] },
    });
    expect((await search('q=unreleased')).body.results).toHaveLength(0);
  });

  it('returns an empty list when nothing matches', async () => {
    await publish('gsap', [paragraph('Animations with GSAP.')]);
    expect((await search('q=kubernetes')).body.results).toEqual([]);
  });

  it('rejects searches that are too short or too long', async () => {
    expect((await search('q=a')).status).toBe(400);
    expect((await search(`q=${'x'.repeat(201)}`)).status).toBe(400);
    expect((await search('')).status).toBe(400);
  });
});

describe('snippet parts', () => {
  it('splits marked text into highlighted and plain pieces', () => {
    expect(toSnippetParts('Use \u0002ScrollTrigger\u0003 to\n pin it')).toEqual([
      { text: 'Use ', highlight: false },
      { text: 'ScrollTrigger', highlight: true },
      { text: ' to pin it', highlight: false },
    ]);
  });
});