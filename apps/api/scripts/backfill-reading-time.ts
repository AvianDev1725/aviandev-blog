import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { posts } from '../src/db/schema.js';
import { readingMinutes } from '../src/lib/reading-time.js';

async function main() {
  const rows = await db.select({ id: posts.id, title: posts.title, content: posts.content }).from(posts);

  for (const row of rows) {
    const minutes = readingMinutes(row.content);
    await db
      .update(posts)
      .set({ readingMinutes: minutes, updatedAt: sql`${posts.updatedAt}` })
      .where(eq(posts.id, row.id));
    console.log(`  ${minutes} min  ${row.title}`);
  }

  console.log(`Updated ${rows.length} post(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});