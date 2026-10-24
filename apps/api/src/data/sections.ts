import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts, postSections } from '../db/schema.js';
import { splitIntoSections } from '../lib/sections.js';

export async function syncPostSections(postId: number) {
  const [post] = await db
    .select({ published: posts.published, noindex: posts.noindex, content: posts.content })
    .from(posts)
    .where(eq(posts.id, postId));

  await db.delete(postSections).where(eq(postSections.postId, postId));
  if (!post || !post.published || post.noindex) return;

  const sections = splitIntoSections(post.content);
  if (sections.length > 0) {
    await db.insert(postSections).values(sections.map((section) => ({ ...section, postId })));
  }
}