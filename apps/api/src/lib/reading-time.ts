type DocNode = { type?: string; text?: string; content?: DocNode[] };
type Totals = { prose: number; code: number; images: number };

const PROSE_WORDS_PER_MINUTE = 200;
const CODE_WORDS_PER_MINUTE = 100;
const SECONDS_PER_IMAGE = 12;

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function walk(node: DocNode, totals: Totals, inCode: boolean) {
  if (node.type === 'image') totals.images += 1;

  const isCode = inCode || node.type === 'codeBlock';
  if (typeof node.text === 'string') {
    if (isCode) totals.code += countWords(node.text);
    else totals.prose += countWords(node.text);
  }

  for (const child of node.content ?? []) walk(child, totals, isCode);
}

export function readingMinutes(doc: unknown) {
  const totals: Totals = { prose: 0, code: 0, images: 0 };
  if (doc && typeof doc === 'object') walk(doc as DocNode, totals, false);

  const minutes =
    totals.prose / PROSE_WORDS_PER_MINUTE +
    totals.code / CODE_WORDS_PER_MINUTE +
    (totals.images * SECONDS_PER_IMAGE) / 60;

  return Math.max(1, Math.round(minutes));
}