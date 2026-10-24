import { describe, it, expect } from 'vitest';
import { headingAnchors } from '@aviandev/core/text';
import { splitIntoSections } from '../src/lib/sections.js';

const text = (value: string) => ({ type: 'text', text: value });
const paragraph = (value: string) => ({ type: 'paragraph', content: [text(value)] });
const heading = (value: string, level = 2) => ({ type: 'heading', attrs: { level }, content: [text(value)] });
const doc = (...content: object[]) => ({ type: 'doc', content });

describe('heading anchors', () => {
  it('turns headings into unique, URL-friendly anchors', () => {
    expect(headingAnchors(['What Is GSAP?', 'Examples', 'Examples', '!!!'])).toEqual([
      'what-is-gsap',
      'examples',
      'examples-2',
      'section',
    ]);
  });
});

describe('splitting posts into sections', () => {
  it('starts a new section at every heading, with an intro before the first', () => {
    const sections = splitIntoSections(
      doc(paragraph('Welcome.'), heading('What Is GSAP?'), paragraph('A library.'), heading('Setup', 3), paragraph('Install it.')),
    );
    expect(sections.map(({ anchor, heading: title, content }) => ({ anchor, title, content }))).toEqual([
      { anchor: '', title: '', content: 'Welcome.' },
      { anchor: 'what-is-gsap', title: 'What Is GSAP?', content: 'A library.' },
      { anchor: 'setup', title: 'Setup', content: 'Install it.' },
    ]);
  });

  it('includes lists, code and image alt text', () => {
    const [section] = splitIntoSections(
      doc(
        { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('Timelines')] }] },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [text("cacheLife('hours')")] },
        { type: 'image', attrs: { src: '/media/a.webp', alt: 'A scroll animation demo' } },
      ),
    );
    expect(section.content).toBe("- Timelines\ncacheLife('hours')\nA scroll animation demo");
  });

  it('keeps a heading with nothing under it', () => {
    const sections = splitIntoSections(doc(heading('Part one'), heading('Details', 3), paragraph('Text.')));
    expect(sections.map((section) => section.anchor)).toEqual(['part-one', 'details']);
  });

  it('splits long sections at paragraph boundaries', () => {
    const long = 'word '.repeat(200).trim();
    const sections = splitIntoSections(doc(heading('Long'), paragraph(long), paragraph(long)));
    expect(sections).toHaveLength(2);
    expect(sections.every((section) => section.anchor === 'long')).toBe(true);
  });

  it('gives unchanged text the same fingerprint', () => {
    const first = splitIntoSections(doc(heading('A'), paragraph('Same')));
    const second = splitIntoSections(doc(heading('A'), paragraph('Same')));
    const changed = splitIntoSections(doc(heading('A'), paragraph('Different')));
    expect(second[0].contentHash).toBe(first[0].contentHash);
    expect(changed[0].contentHash).not.toBe(first[0].contentHash);
  });

  it('copes with empty or missing content', () => {
    expect(splitIntoSections(doc())).toEqual([]);
    expect(splitIntoSections(null)).toEqual([]);
  });
});