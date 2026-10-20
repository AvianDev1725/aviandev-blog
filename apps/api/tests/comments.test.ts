import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import app from '../src/app.js';
import { db } from '../src/db/index.js';
import { comments, users } from '../src/db/schema.js';
import { cookieFor, createUser, loginAs, resetDb, send } from './helpers.js';

let author: string;
let otherAdmin: string;
let superAdmin: string;

beforeEach(async () => {
  await resetDb();
  author = await cookieFor('admin', 'author@test.com');
  otherAdmin = await cookieFor('admin', 'other@test.com');
  superAdmin = await cookieFor('super_admin');
  await db.update(users).set({ emailVerifiedAt: new Date() });
  await send('POST', '/posts', author, { title: 'Hello', slug: 'hello', published: true });
});

const human = () => ({ startedAt: Date.now() - 10_000 });

async function reader(email = 'reader@test.com', verified = true) {
  const user = await createUser(email, 'reader');
  if (verified) await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
  return { id: user.id, cookie: await loginAs(email) };
}

const post = (cookie: string | undefined, fields: object) =>
  send('POST', '/comments', cookie, { postSlug: 'hello', ...human(), ...fields });

const list = async () => (await app.request('/comments?post=hello')).json();

describe('posting comments', () => {
  it('shows a confirmed reader’s comment immediately', async () => {
    const { cookie } = await reader();
    const res = await post(cookie, { body: 'Great post!' });
    expect(res.status).toBe(201);
    expect((await res.json()).status).toBe('approved');

    const { count, comments: shown } = await list();
    expect(count).toBe(1);
    expect(shown[0]).toMatchObject({ body: 'Great post!', author: { kind: 'reader', name: 'Test User', isStaff: false } });
  });

  it('asks unconfirmed readers to confirm their email', async () => {
    const { cookie } = await reader('new@test.com', false);
    expect((await post(cookie, { body: 'Hi' })).status).toBe(403);
  });

  it('holds guest comments for approval, and needs an avatar', async () => {
    expect((await post(undefined, { body: 'Hello' })).status).toBe(400);

    const res = await post(undefined, { body: 'Hello', guestAvatar: 'owl' });
    expect(res.status).toBe(201);
    expect((await res.json()).status).toBe('pending');
    expect((await list()).count).toBe(0);
  });

  it('quietly drops bots without saving anything', async () => {
    const trap = await post(undefined, { body: 'Buy now', guestAvatar: 'owl', website: 'spam.example' });
    const tooFast = await post(undefined, { body: 'Buy now', guestAvatar: 'owl', startedAt: Date.now() });
    expect(trap.status).toBe(202);
    expect(tooFast.status).toBe(202);
    expect(await db.select().from(comments)).toHaveLength(0);
  });

  it('holds reader comments with several links', async () => {
    const { cookie } = await reader();
    const res = await post(cookie, { body: 'See https://a.example and https://b.example' });
    expect((await res.json()).status).toBe('pending');
  });

  it('gives staff an Author badge', async () => {
    await post(author, { body: 'Thanks for reading!' });
    expect((await list()).comments[0].author.isStaff).toBe(true);
  });

  it('attaches replies to the top of the thread', async () => {
    const { cookie } = await reader();
    const top = (await (await post(cookie, { body: 'Question' })).json()).comment;
    const reply = (await (await post(author, { body: 'Answer', parentId: top.id })).json()).comment;
    const nested = (await (await post(cookie, { body: 'Thanks', parentId: reply.id })).json()).comment;
    expect(nested.parentId).toBe(top.id);
  });

  it("doesn't allow comments on drafts", async () => {
    await send('POST', '/posts', author, { title: 'Draft', slug: 'draft' });
    const res = await send('POST', '/comments', undefined, { postSlug: 'draft', body: 'Hi', guestAvatar: 'owl', ...human() });
    expect(res.status).toBe(404);
  });
});

describe('editing and deleting', () => {
  it('lets readers edit their own comments, marked as edited', async () => {
    const { cookie } = await reader();
    const { comment } = await (await post(cookie, { body: 'Frist!' })).json();
    const res = await send('PATCH', `/comments/${comment.id}`, cookie, { body: 'First!' });
    expect((await res.json()).comment).toMatchObject({ body: 'First!', edited: true });
  });

  it("doesn't let anyone edit someone else's comment", async () => {
    const { cookie } = await reader();
    const intruder = await reader('intruder@test.com');
    const { comment } = await (await post(cookie, { body: 'Mine' })).json();
    expect((await send('PATCH', `/comments/${comment.id}`, intruder.cookie, { body: 'Hacked' })).status).toBe(404);
  });

  it('sends an edit with several links back for approval', async () => {
    const { cookie } = await reader();
    const { comment } = await (await post(cookie, { body: 'Nice' })).json();
    const res = await send('PATCH', `/comments/${comment.id}`, cookie, { body: 'https://a.example https://b.example' });
    expect((await res.json()).status).toBe('pending');
    expect((await list()).count).toBe(0);
  });

  it('removes a comment with no replies completely', async () => {
    const { cookie } = await reader();
    const { comment } = await (await post(cookie, { body: 'Oops' })).json();
    expect((await send('DELETE', `/comments/${comment.id}`, cookie)).status).toBe(204);
    expect((await list()).comments).toHaveLength(0);
  });

  it('leaves a placeholder when a deleted comment has replies', async () => {
    const { cookie } = await reader();
    const { comment } = await (await post(cookie, { body: 'Question' })).json();
    await post(author, { body: 'Answer', parentId: comment.id });
    await send('DELETE', `/comments/${comment.id}`, cookie);

    const { count, comments: shown } = await list();
    expect(count).toBe(1);
    expect(shown[0]).toMatchObject({ deleted: true, body: '', author: null });
  });
});

describe('moderation', () => {
  async function guestComment() {
    await post(undefined, { body: 'Guest here', guestAvatar: 'robin' });
    const [row] = await db.select().from(comments);
    return row.id;
  }

  it("shows the post's author their waiting comments, and lets them approve", async () => {
    const id = await guestComment();
    const queue = await (await send('GET', '/moderation/comments?status=pending', author)).json();
    expect(queue.counts.pending).toBe(1);
    expect(queue.comments[0].authorEmail).toBeNull();

    expect((await send('POST', `/moderation/comments/${id}/approve`, author)).status).toBe(200);
    expect((await list()).comments[0].author).toEqual({ kind: 'guest', avatar: 'robin' });
  });

  it("hides other admins' comments from an admin", async () => {
    const id = await guestComment();
    const queue = await (await send('GET', '/moderation/comments', otherAdmin)).json();
    expect(queue.comments).toHaveLength(0);
    expect((await send('POST', `/moderation/comments/${id}/approve`, otherAdmin)).status).toBe(404);
  });

  it('lets super admins moderate everything', async () => {
    const id = await guestComment();
    expect((await send('POST', `/moderation/comments/${id}/spam`, superAdmin)).status).toBe(200);
    expect((await send('DELETE', `/moderation/comments/${id}`, superAdmin)).status).toBe(204);
  });

  it('keeps readers out of moderation', async () => {
    const { cookie } = await reader();
    expect((await send('GET', '/moderation/comments', cookie)).status).toBe(403);
  });
});

describe('banning', () => {
  it('hides all of a reader’s comments and stops them commenting', async () => {
    const { id, cookie } = await reader();
    await post(cookie, { body: 'First' });
    await post(cookie, { body: 'Second' });

    const res = await send('POST', `/moderation/readers/${id}/ban`, superAdmin);
    expect((await res.json()).hidden).toBe(2);
    expect((await list()).count).toBe(0);
    expect((await post(cookie, { body: 'Third' })).status).toBe(403);

    await send('DELETE', `/moderation/readers/${id}/ban`, superAdmin);
    expect((await post(cookie, { body: 'Back again' })).status).toBe(201);
  });

  it('only lets super admins ban, and only readers', async () => {
    const { id } = await reader();
    expect((await send('POST', `/moderation/readers/${id}/ban`, author)).status).toBe(403);

    const [admin] = await db.select().from(users).where(eq(users.email, 'author@test.com'));
    expect((await send('POST', `/moderation/readers/${admin.id}/ban`, superAdmin)).status).toBe(400);
  });
});