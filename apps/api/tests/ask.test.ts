import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { askEvents, posts, postSections } from '../src/db/schema.js';
import { citedNumbers, cleanTopic, followUpTopics } from '../src/lib/ask-prompt.js';
import { cookieFor, resetDb, send } from './helpers.js';

const BROWSER = 'Mozilla/5.0 (Macintosh) Chrome/155.0 Safari/537.36';

const PRETEND = {
  enabled: true,
  adminEnabled: false,
  provider: 'pretend',
  model: 'pretend',
  baseUrl: '',
  dailyLimit: 100,
  perReaderLimit: 20,
  answerLength: 'medium',
  creativity: 2,
};

let superAdmin: string;

beforeEach(async () => {
  await resetDb();
  superAdmin = await cookieFor('super_admin');

  const [post] = await db
    .insert(posts)
    .values({ title: 'GSAP timelines', slug: 'gsap-timelines', published: true, publishedAt: new Date() })
    .returning({ id: posts.id });
  await db.insert(postSections).values([
    {
      postId: post.id,
      position: 0,
      anchor: 'why-timelines',
      heading: 'Why timelines',
      content: 'A GSAP timeline lines up tweens one after another, so you can play, pause and reverse them together.',
      contentHash: 'why',
    },
    {
      postId: post.id,
      position: 1,
      anchor: 'position-parameter',
      heading: 'The position parameter',
      content: 'The position parameter decides where a tween lands on the GSAP timeline.',
      contentHash: 'position',
    },
  ]);
});

const configure = (settings: object = PRETEND) => send('PUT', '/assistant/settings', superAdmin, settings);

async function ask(body: object, userAgent = BROWSER) {
  return app.request('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': userAgent, 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  });
}

function events(text: string) {
  return text
    .split('\n\n')
    .filter((block) => block.trim())
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      return { event, data: data ? JSON.parse(data) : null };
    });
}

describe('assistant settings', () => {
  it('is for super admins only', async () => {
    const admin = await cookieFor('admin');
    expect((await send('GET', '/assistant/settings', admin)).status).toBe(403);
    expect((await send('GET', '/assistant/settings')).status).toBe(401);
  });

  it('starts switched off and lists providers without showing keys', async () => {
    const data = await (await send('GET', '/assistant/settings', superAdmin)).json();
    expect(data.settings.enabled).toBe(false);
    const groq = data.providers.find((provider: { id: string }) => provider.id === 'groq');
    expect(groq).toMatchObject({ keyEnv: 'GROQ_API_KEY' });
    expect(JSON.stringify(data)).not.toContain(process.env.GROQ_API_KEY || 'no-key-in-tests');
  });

  it('refuses to switch on a provider whose key is missing', async () => {
    const saved = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const res = await configure({ ...PRETEND, provider: 'groq', model: 'openai/gpt-oss-120b' });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('GROQ_API_KEY');
    } finally {
      if (saved !== undefined) process.env.GROQ_API_KEY = saved;
    }
  });

  it('needs a base URL for other compatible providers', async () => {
    expect((await configure({ ...PRETEND, enabled: false, provider: 'custom' })).status).toBe(400);
  });
});

describe('asking', () => {
  it('is turned off until a super admin switches it on', async () => {
    expect(await (await app.request('/ask/config')).json()).toEqual({ enabled: false, remaining: 0 });
    const res = await ask({ question: 'GSAP timeline tweens' });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('disabled');
  });

  it('streams sources, the answer and follow-ups, and logs the question', async () => {
    await configure();
    const res = await ask({ question: 'GSAP timeline tweens' });
    expect(res.status).toBe(200);

    const stream = events(await res.text());
    const sources = stream.find((item) => item.event === 'sources')?.data;
    expect(sources[0]).toMatchObject({ n: 1, url: expect.stringContaining('/posts/gsap-timelines') });
    expect(sources[0].content).toBeUndefined();

    const answer = stream.filter((item) => item.event === 'delta').map((item) => item.data.text).join('');
    expect(answer).toContain('[1]');

    const done = stream.find((item) => item.event === 'done')?.data;
    expect(done.cited).toEqual([1]);
    expect(done.followUps.length).toBeGreaterThan(0);

    const [row] = await db.select().from(askEvents);
    expect(row).toMatchObject({ id: done.id, status: 'answered', provider: 'pretend' });
  });

  it('says not found without calling the model when nothing matches', async () => {
    await configure();
    const stream = events(await (await ask({ question: 'zebra quantum pancakes' })).text());
    expect(stream.map((item) => item.event)).toEqual(['not_found']);
    expect((await db.select().from(askEvents))[0].status).toBe('not_found');
  });

  it('turns the model saying NOT_FOUND into a not found event', async () => {
    await configure();
    const res = await ask({
      question: 'GSAP timeline tweens',
      history: [{ question: 'pretend-not-found', answer: 'Earlier answer.' }],
    });
    const stream = events(await res.text());
    expect(stream.map((item) => item.event)).toEqual(['sources', 'not_found']);
    expect((await db.select().from(askEvents))[0].status).toBe('not_found');
  });

  it('stops readers after their daily limit', async () => {
    await configure({ ...PRETEND, perReaderLimit: 1 });
    await (await ask({ question: 'GSAP timeline tweens' })).text();
    const res = await ask({ question: 'GSAP timeline tweens' });
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('reader_limit');
  });

  it('ignores bots and checks the question', async () => {
    await configure();
    expect((await ask({ question: 'GSAP timeline' }, 'Googlebot/2.1')).status).toBe(403);
    expect((await ask({ question: 'x'.repeat(501) })).status).toBe(400);
  });

  it('saves helpful or not helpful feedback', async () => {
    await configure();
    const done = events(await (await ask({ question: 'GSAP timeline tweens' })).text()).find((item) => item.event === 'done')?.data;
    const res = await app.request(`/ask/${done.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful: true }),
    });
    expect(res.status).toBe(204);
    expect((await db.select().from(askEvents))[0].helpful).toBe(true);
  });
});

describe('answer helpers', () => {
  it('finds which sources an answer cited', () => {
    expect(citedNumbers('Yes [2]. Also [1] and [2]. Not [9].', 3)).toEqual([1, 2]);
  });

  it('suggests follow-ups from sections the answer did not use first', () => {
    const sources = [
      { n: 1, url: '/posts/a#x', postTitle: 'A', heading: 'Why timelines', content: '' },
      { n: 2, url: '/posts/a#y', postTitle: 'A', heading: 'The position parameter', content: '' },
      { n: 3, url: '/posts/a', postTitle: 'A', heading: '', content: '' },
    ];
    expect(followUpTopics(sources, [1])).toEqual(['The position parameter', 'Why timelines']);
  });

  it('turns headings into clean follow-up topics', () => {
    expect(cleanTopic('4. Mastering GSAP Timelines')).toBe('Mastering GSAP Timelines');
    expect(cleanTopic('Step 2: Install GSAP')).toBe('Install GSAP');
    expect(cleanTopic('Conclusion')).toBe('');
    expect(cleanTopic('Modern websites are no longer limited to static layouts and simple hover effects.')).toBe('');
  });
});