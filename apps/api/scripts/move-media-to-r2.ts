import { eq, isNotNull } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { media } from '../src/db/schema.js';
import { storage } from '../src/lib/storage.js';

async function main() {
  const rows = await db
    .select({ id: media.id, mimeType: media.mimeType, data: media.data })
    .from(media)
    .where(isNotNull(media.data));

  console.log(`Moving ${rows.length} file(s) to R2…`);

  for (const row of rows) {
    await storage().put(row.id, Buffer.from(row.data!, 'base64'), row.mimeType);
    await db.update(media).set({ data: null }).where(eq(media.id, row.id));
    console.log(`  ✓ ${row.id}`);
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});