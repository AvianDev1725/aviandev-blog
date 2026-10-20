import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { media } from '../db/schema.js';
import { canWrite, type AuthEnv } from '../middleware/auth.js';
import { detectImageType } from '../lib/file-type.js';
import { storage } from '../lib/storage.js';

const MAX_BYTES = 5 * 1024 * 1024;
const TOO_LARGE = 'Files must be 5 MB or smaller';

const mediaRoute = new Hono<AuthEnv>();

mediaRoute.post(
  '/',
  ...canWrite,
  bodyLimit({
    maxSize: MAX_BYTES + 64 * 1024,
    onError: (c) => c.json({ error: TOO_LARGE }, 413),
  }),
  async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File) || file.size === 0) return c.json({ error: 'Choose a file to upload' }, 400);
    if (file.size > MAX_BYTES) return c.json({ error: TOO_LARGE }, 413);

    const bytes = Buffer.from(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) return c.json({ error: 'Upload a PNG, JPEG, GIF, WebP, ICO or SVG image' }, 400);

    const id = `${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}.${type.ext}`;
    const response = { id, url: `/media/${id}`, mimeType: type.mime, size: bytes.length };

    const [existing] = await db.select({ id: media.id }).from(media).where(eq(media.id, id));
    if (existing) return c.json(response, 201);

    await storage().put(id, bytes, type.mime);
    await db
      .insert(media)
      .values({
        id,
        filename: file.name.slice(0, 200),
        mimeType: type.mime,
        size: bytes.length,
        uploadedBy: c.get('user').id,
      })
      .onConflictDoNothing({ target: media.id });

    return c.json(response, 201);
  },
);

mediaRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [file] = await db
    .select({ mimeType: media.mimeType, data: media.data })
    .from(media)
    .where(eq(media.id, id));
  if (!file) return c.json({ error: 'File not found' }, 404);

  const bytes = file.data ? new Uint8Array(Buffer.from(file.data, 'base64')) : await storage().get(id);
  if (!bytes) return c.json({ error: 'File not found' }, 404);

  return c.body(bytes, 200, {
    'Content-Type': file.mimeType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
});

export default mediaRoute;