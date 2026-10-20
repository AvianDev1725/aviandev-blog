import { describe, it, expect } from 'vitest';
import { readingMinutes } from '../src/lib/reading-time.js';

const paragraph = (words: number) => ({
  type: 'paragraph',
  content: [{ type: 'text', text: Array(words).fill('word').join(' ') }],
});

const codeBlock = (words: number) => ({
  type: 'codeBlock',
  content: [{ type: 'text', text: Array(words).fill('token').join(' ') }],
});

const doc = (...content: object[]) => ({ type: 'doc', content });

describe('reading time', () => {
  it('is at least one minute, even for an empty post', () => {
    expect(readingMinutes(doc())).toBe(1);
    expect(readingMinutes(null)).toBe(1);
  });

  it('reads normal text at 200 words a minute', () => {
    expect(readingMinutes(doc(paragraph(1000)))).toBe(5);
  });

  it('reads code more slowly than text', () => {
    expect(readingMinutes(doc(codeBlock(500)))).toBe(5);
  });

  it('adds time for images', () => {
    const images = Array.from({ length: 10 }, () => ({ type: 'image', attrs: { src: '/media/a.webp' } }));
    expect(readingMinutes(doc(paragraph(400), ...images))).toBe(4);
  });
});