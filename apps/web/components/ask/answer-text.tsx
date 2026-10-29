import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { fill } from '@aviandev/core/text';
import type { AskSource } from '@/lib/ask';

type Block = { type: 'p' | 'h' | 'ul' | 'ol' | 'code'; lines: string[] };

export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'p', lines: paragraph });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      blocks.push({ type: 'code', lines: code });
      continue;
    }

    const item = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const type = item[1] ? 'ol' : 'ul';
      const previous = blocks.at(-1);
      if (previous?.type === type) previous.lines.push(item[2]);
      else blocks.push({ type, lines: [item[2]] });
      continue;
    }

    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'h', lines: [heading[1]] });
      continue;
    }

    if (line.trim()) paragraph.push(line.trim());
    else flush();
  }
  flush();
  return blocks;
}

type Props = {
  text: string;
  sources: AskSource[];
  streaming?: boolean;
  citeLabel: string;
  onSourceClick?: () => void;
};

export default function AnswerText({ text, sources, streaming = false, citeLabel, onSourceClick }: Props) {
  const byNumber = new Map(sources.map((source) => [source.n, source]));
  const blocks = toBlocks(text);
  const caret = streaming ? <span className="ask-caret" aria-hidden /> : null;

  function inline(value: string, key: string): ReactNode[] {
    return value.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[\d{1,2}\])/g).map((part, index) => {
      const id = `${key}-${index}`;
      if (!part) return null;
      if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={id} className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[0.85em] ring-1 ring-teal-100">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return <strong key={id}>{part.slice(2, -2)}</strong>;
      const cite = /^\[(\d{1,2})\]$/.exec(part);
      const source = cite ? byNumber.get(Number(cite[1])) : undefined;
      if (cite && source) {
        return (
          <Link
            key={id}
            href={source.url}
            onClick={onSourceClick}
            className="ask-cite"
            aria-label={fill(citeLabel, { n: String(source.n), title: source.heading || source.postTitle })}
          >
            {source.n}
          </Link>
        );
      }
      if (cite) return null;
      return <Fragment key={id}>{part}</Fragment>;
    });
  }

  return (
    <div className="space-y-2.5">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        const isLast = index === blocks.length - 1;
        if (block.type === 'code') {
          return (
            <pre key={key} className="-mx-1 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-[13px] leading-relaxed text-zinc-100">
              <code>{block.lines.join('\n')}</code>
            </pre>
          );
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const List = block.type;
          return (
            <List key={key} className={`space-y-1 pl-5 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'}`}>
              {block.lines.map((line, item) => (
                <li key={`${key}-${item}`}>
                  {inline(line, `${key}-${item}`)}
                  {isLast && item === block.lines.length - 1 && caret}
                </li>
              ))}
            </List>
          );
        }
        if (block.type === 'h') {
          return (
            <p key={key} className="font-semibold text-zinc-900">
              {inline(block.lines[0], key)}
              {isLast && caret}
            </p>
          );
        }
        return (
          <p key={key}>
            {inline(block.lines.join(' '), key)}
            {isLast && caret}
          </p>
        );
      })}
      {streaming && (blocks.length === 0 || blocks.at(-1)?.type === 'code') && <p>{caret}</p>}
    </div>
  );
}