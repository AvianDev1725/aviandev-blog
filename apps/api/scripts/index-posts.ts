import { db } from '../src/db/index.js';
import { posts } from '../src/db/schema.js';
import { syncPostSections } from '../src/data/sections.js';

async function main() {
  const rows = await db.select({ id: posts.id, title: posts.title }).from(posts);
  for (const row of rows) {
    await syncPostSections(row.id);
    console.log(`  ✓ ${row.title}`);
  }
  console.log(`Indexed ${rows.length} post(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});