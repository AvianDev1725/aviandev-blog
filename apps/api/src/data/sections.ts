import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts, postSections } from '../db/schema.js';
import { embedDocuments } from '../lib/embeddings.js';
import { embeddingText, splitIntoSections } from '../lib/sections.js';

export async function syncPostSections(postId: number) {
  const [post] = await db
    .select({ title: posts.title, published: posts.published, noindex: posts.noindex, content: posts.content })
    .from(posts)
    .where(eq(posts.id, postId));

  const existing = await db
    .select({ contentHash: postSections.contentHash, embedding: postSections.embedding })
    .from(postSections)
    .where(eq(postSections.postId, postId));

  const searchable = post && post.published && !post.noindex;
  const sections = searchable ? splitIntoSections(post.content, post.title) : [];

  const known = new Map<string, number[]>();
  for (const row of existing) if (row.embedding) known.set(row.contentHash, row.embedding);

  const missing = sections.filter((section) => !known.has(section.contentHash));
  if (missing.length > 0) {
    try {
      const vectors = await embedDocuments(missing.map((section) => embeddingText(post!.title, section)));
      missing.forEach((section, index) => known.set(section.contentHash, vectors[index]));
    } catch (error) {
      console.error(`[embeddings] could not embed post ${postId}; keyword search still works:`, error);
    }
  }

  await db.delete(postSections).where(eq(postSections.postId, postId));
  if (sections.length > 0) {
    await db.insert(postSections).values(
      sections.map((section) => ({ ...section, postId, embedding: known.get(section.contentHash) ?? null })),
    );
  }

  return { sections: sections.length, embedded: missing.length };
}