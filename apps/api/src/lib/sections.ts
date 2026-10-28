import { createHash } from 'node:crypto';
import { headingAnchors } from '@aviandev/core/text';

type DocNode = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: DocNode[] };

export type Section = {
  position: number;
  anchor: string;
  heading: string;
  content: string;
  contentHash: string;
};

const MAX_SECTION_CHARS = 1500;

function headingText(node: DocNode): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(headingText).join('');
}

function inlineText(node: DocNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  return (node.content ?? []).map(inlineText).join('');
}

function blockText(node: DocNode): string {
  switch (node.type) {
    case 'paragraph':
      return inlineText(node).trim();
    case 'codeBlock':
      return (node.content ?? []).map((child) => child.text ?? '').join('').trim();
    case 'image':
      return typeof node.attrs?.alt === 'string' ? node.attrs.alt.trim() : '';
    case 'bulletList':
    case 'orderedList':
      return (node.content ?? [])
        .map((item) => (item.content ?? []).map(blockText).filter(Boolean).join(' '))
        .filter(Boolean)
        .map((item) => `- ${item}`)
        .join('\n');
    default:
      return (node.content ?? []).map(blockText).filter(Boolean).join('\n');
  }
}

function packBlocks(blocks: string[]) {
  const parts: string[] = [];
  let current = '';
  for (const block of blocks) {
    if (current && current.length + block.length + 1 > MAX_SECTION_CHARS) {
      parts.push(current);
      current = '';
    }
    current = current ? `${current}\n${block}` : block;
  }
  if (current) parts.push(current);
  return parts;
}

const fingerprint = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 32);

export function splitIntoSections(doc: unknown, title = ''): Section[] {
  const nodes = (doc as DocNode | null)?.content ?? [];
  const headings = nodes.filter((node) => node.type === 'heading');
  const anchors = headingAnchors(headings.map(headingText));

  const groups: { anchor: string; heading: string; blocks: string[] }[] = [{ anchor: '', heading: '', blocks: [] }];
  let headingIndex = 0;

  for (const node of nodes) {
    if (node.type === 'heading') {
      groups.push({ anchor: anchors[headingIndex], heading: headingText(node).trim(), blocks: [] });
      headingIndex += 1;
      continue;
    }
    const text = blockText(node);
    if (text) groups[groups.length - 1].blocks.push(text);
  }

  const sections: Section[] = [];
  for (const group of groups) {
    const parts = packBlocks(group.blocks);
    if (parts.length === 0 && group.heading) parts.push('');

    for (const content of parts) {
      sections.push({
        position: sections.length,
        anchor: group.anchor,
        heading: group.heading,
        content,
        contentHash: fingerprint(`${title}\n${group.heading}\n${content}`),
      });
    }
  }
  return sections;
}

export function embeddingText(title: string, section: Pick<Section, 'heading' | 'content'>) {
  return [title, section.heading, section.content].filter(Boolean).join('\n');
}