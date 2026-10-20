import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/app.js';
import { createPreviewToken } from '../src/lib/preview-token.js';
import { cookieFor, resetDb, send } from './helpers.js';

let admin: string;
let otherAdmin: string;

beforeEach(async () => {
  await resetDb();
  admin = await cookieFor('admin');
  otherAdmin = await cookieFor('admin', 'other@test.com');
});

async function createDraft() {
  return (await send('POST', '/posts', admin, { title: 'Secret draft', slug: 'secret-draft' })).json();
}

describe('draft previews', () => {
  it('lets the author preview an unpublished post', async () => {
    const draft = await createDraft();
    const { token } = await (await send('POST', `/admin/posts/${draft.id}/preview`, admin)).json();

    const res = await app.request(`/preview/${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).title).toBe('Secret draft');
  });

  it("doesn't let another admin create a preview", async () => {
    const draft = await createDraft();
    expect((await send('POST', `/admin/posts/${draft.id}/preview`, otherAdmin)).status).toBe(403);
  });

  it('rejects a token pointed at a different post', async () => {
    const draft = await createDraft();
    const { token } = await (await send('POST', `/admin/posts/${draft.id}/preview`, admin)).json();
    const [, expires, signature] = token.split('.');

    expect((await app.request(`/preview/${draft.id + 1}.${expires}.${signature}`)).status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const draft = await createDraft();
    const { token } = createPreviewToken(draft.id, -1000);
    expect((await app.request(`/preview/${token}`)).status).toBe(401);
  });

  it('rejects nonsense', async () => {
    expect((await app.request('/preview/not-a-token')).status).toBe(401);
  });

  it('keeps drafts off the public post route', async () => {
    await createDraft();
    expect((await app.request('/posts/secret-draft')).status).toBe(404);
  });
});