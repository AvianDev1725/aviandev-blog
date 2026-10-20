import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { media } from '../db/schema.js';
import { canWrite, type AuthEnv } from '../middleware/auth.js';
import { detectImageType } from '../lib/file-type.js';

const MAX_BYTES = 1024 * 1024;

const mediaRoute = new Hono<AuthEnv>();

mediaRoute.post(
  '/',
  ...canWrite,
  bodyLimit({
    maxSize: MAX_BYTES + 64 * 1024,
    onError: (c) => c.json({ error: 'Files must be 1 MB or smaller' }, 413),
  }),
  async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File) || file.size === 0) return c.json({ error: 'Choose a file to upload' }, 400);
    if (file.size > MAX_BYTES) return c.json({ error: 'Files must be 1 MB or smaller' }, 413);

    const bytes = Buffer.from(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) return c.json({ error: 'Upload a PNG, JPEG, GIF, WebP, ICO or SVG image' }, 400);

    const id = `${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}.${type.ext}`;
    await db
      .insert(media)
      .values({
        id,
        filename: file.name.slice(0, 200),
        mimeType: type.mime,
        size: bytes.length,
        data: bytes.toString('base64'),
        uploadedBy: c.get('user').id,
      })
      .onConflictDoNothing({ target: media.id });

    return c.json({ id, url: `/media/${id}`, mimeType: type.mime, size: bytes.length }, 201);
  }
);

mediaRoute.get('/:id', async (c) => {
  const [file] = await db
    .select({ mimeType: media.mimeType, data: media.data })
    .from(media)
    .where(eq(media.id, c.req.param('id')));
  if (!file) return c.json({ error: 'File not found' }, 404);

  return c.body(new Uint8Array(Buffer.from(file.data, 'base64')), 200, {
    'Content-Type': file.mimeType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
});

export default mediaRoute;