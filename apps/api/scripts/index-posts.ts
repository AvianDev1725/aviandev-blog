import { count, isNull } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { posts, postSections } from '../src/db/schema.js';
import { syncPostSections } from '../src/data/sections.js';

async function main() {
  const rows = await db.select({ id: posts.id, title: posts.title }).from(posts);
  console.log(`Indexing ${rows.length} post(s). The first run downloads the model (about 34 MB)…`);

  for (const row of rows) {
    const started = Date.now();
    const { sections, embedded } = await syncPostSections(row.id);
    console.log(`  ✓ ${row.title}: ${sections} section(s), ${embedded} newly embedded (${Date.now() - started} ms)`);
  }

  const [{ value: withoutMeaning }] = await db
    .select({ value: count() })
    .from(postSections)
    .where(isNull(postSections.embedding));
  console.log(withoutMeaning === 0 ? 'All sections have embeddings.' : `${withoutMeaning} section(s) still need embeddings. Run again.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});