import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/app.js';
import { cookieFor, resetDb } from './helpers.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>alert(1)</script></svg>');

let admin: string;

beforeEach(async () => {
  await resetDb();
  admin = await cookieFor('admin');
});

function upload(cookie: string | undefined, bytes: Buffer, name: string, type: string) {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(bytes)], name, { type }));
  return app.request('/media', { method: 'POST', body: form, headers: cookie ? { Cookie: cookie } : {} });
}

describe('media uploads', () => {
  it('stores a PNG and serves it back with long-term caching', async () => {
    const res = await upload(admin, PNG, 'icon.png', 'image/png');
    expect(res.status).toBe(201);
    const { url } = await res.json();
    expect(url).toMatch(/^\/media\/[a-f0-9]{32}\.png$/);

    const file = await app.request(url);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(file.headers.get('cache-control')).toContain('immutable');
    expect(Buffer.from(await file.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it('gives the same file the same address', async () => {
    const first = await (await upload(admin, PNG, 'a.png', 'image/png')).json();
    const second = await (await upload(admin, PNG, 'b.png', 'image/png')).json();
    expect(second.url).toBe(first.url);
  });

  it('checks the real contents, not the file name', async () => {
    const res = await upload(admin, Buffer.from('not an image'), 'fake.png', 'image/png');
    expect(res.status).toBe(400);
  });

  it('rejects files over 1 MB', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(1_100_000)]);
    expect((await upload(admin, big, 'big.png', 'image/png')).status).toBe(413);
  });

  it('serves SVGs in a sandbox that blocks scripts', async () => {
    const { url } = await (await upload(admin, SVG, 'icon.svg', 'image/svg+xml')).json();
    const file = await app.request(url);
    expect(file.headers.get('content-security-policy')).toContain('sandbox');
  });

  it('requires a login to upload', async () => {
    expect((await upload(undefined, PNG, 'icon.png', 'image/png')).status).toBe(401);
  });
});