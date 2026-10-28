import { and, asc, cosineDistance, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { posts, postSections } from '../src/db/schema.js';
import { embedQuery } from '../src/lib/embeddings.js';

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.log('Usage: pnpm search:try "your search"');
    return;
  }

  const vector = await embedQuery(query);
  const distance = cosineDistance(postSections.embedding, vector);

  const results = await db
    .select({
      title: posts.title,
      heading: postSections.heading,
      anchor: postSections.anchor,
      similarity: sql<number>`1 - (${distance})`,
    })
    .from(postSections)
    .innerJoin(posts, eq(postSections.postId, posts.id))
    .where(and(isNotNull(postSections.embedding)))
    .orderBy(asc(distance))
    .limit(5);

  console.log(`\nClosest sections to "${query}":\n`);
  for (const result of results) {
    const where = result.heading ? `${result.title} › ${result.heading}` : result.title;
    console.log(`  ${(result.similarity * 100).toFixed(0).padStart(3)}%  ${where}`);
  }
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});