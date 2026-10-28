import { describe, it, expect } from 'vitest';
import { EMBEDDING_DIMENSIONS, embedDocuments, embedQuery } from '../src/lib/embeddings.js';

const similarity = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);

describe('embeddings (pretend model in tests)', () => {
  it('returns one normalised vector of the right size per text', async () => {
    const [vector] = await embedDocuments(['ScrollTrigger animations']);
    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(Math.hypot(...vector)).toBeCloseTo(1, 5);
  });

  it('is predictable', async () => {
    const [first] = await embedDocuments(['same text']);
    const [second] = await embedDocuments(['same text']);
    expect(second).toEqual(first);
  });

  it('puts related texts closer than unrelated ones', async () => {
    const query = await embedQuery('gsap scroll animation');
    const [related, unrelated] = await embedDocuments([
      'Use GSAP ScrollTrigger to start an animation on scroll',
      'Upload images to Backblaze storage',
    ]);
    expect(similarity(query, related)).toBeGreaterThan(similarity(query, unrelated));
  });
});