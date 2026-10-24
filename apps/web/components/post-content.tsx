import { Fragment, type ReactNode } from 'react';
import { headingAnchors, isSafeLink } from '@aviandev/core/text';
import CodeBlock from './code-block';
import PostImage from './post-image';

type Mark = { type: string; attrs?: Record<string, unknown> };
export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: Mark[];
};

type Extra = { priority?: boolean; anchor?: string };

function withMarks(text: string, marks: Mark[] = []): ReactNode {
  return marks.reduce<ReactNode>((child, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong>{child}</strong>;
      case 'italic':
        return <em>{child}</em>;
      case 'underline':
        return <u>{child}</u>;
      case 'strike':
        return <s>{child}</s>;
      case 'code':
        return <code>{child}</code>;
      case 'link': {
        const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href.trim() : '';
        if (!isSafeLink(href)) return child;
        const external = !href.startsWith('/');
        return (
          <a href={href} rel={external ? 'noopener noreferrer' : undefined}>
            {child}
          </a>
        );
      }
      default:
        return child;
    }
  }, text);
}

function textOf(node: DocNode): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(textOf).join('');
}

function renderNodes(nodes: DocNode[] = []): ReactNode {
  return nodes.map((node, index) => <Fragment key={index}>{renderNode(node)}</Fragment>);
}

function renderNode(node: DocNode, extra: Extra = {}): ReactNode {
  switch (node.type) {
    case 'text':
      return withMarks(node.text ?? '', node.marks);
    case 'paragraph':
      return <p>{renderNodes(node.content)}</p>;
    case 'heading': {
      const level = Math.min(4, Math.max(2, Number(node.attrs?.level) || 2));
      const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
      return <Tag id={extra.anchor}>{renderNodes(node.content)}</Tag>;
    }
    case 'bulletList':
      return <ul>{renderNodes(node.content)}</ul>;
    case 'orderedList': {
      const start = Number(node.attrs?.start) || 1;
      return <ol start={start > 1 ? start : undefined}>{renderNodes(node.content)}</ol>;
    }
    case 'listItem':
      return <li>{renderNodes(node.content)}</li>;
    case 'blockquote':
      return <blockquote>{renderNodes(node.content)}</blockquote>;
    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      return <CodeBlock code={textOf(node)} language={language} />;
    }
    case 'image':
      return <PostImage {...node.attrs} priority={extra.priority} />;
    case 'hardBreak':
      return <br />;
    case 'horizontalRule':
      return <hr />;
    default:
      return renderNodes(node.content);
  }
}

export default function PostContent({ doc }: { doc: { content?: unknown[] } }) {
  const nodes = (doc.content ?? []) as DocNode[];

  const firstImage = nodes.findIndex((node) => node.type === 'image');
  const loadFirstImageEarly = firstImage !== -1 && firstImage < 4;

  const headingIndexes = nodes.flatMap((node, index) => (node.type === 'heading' ? [index] : []));
  const anchors = headingAnchors(headingIndexes.map((index) => textOf(nodes[index])));
  const anchorAt = new Map(headingIndexes.map((nodeIndex, i) => [nodeIndex, anchors[i]]));

  return (
    <>
      {nodes.map((node, index) => (
        <Fragment key={index}>
          {renderNode(node, {
            priority: loadFirstImageEarly && index === firstImage,
            anchor: anchorAt.get(index),
          })}
        </Fragment>
      ))}
    </>
  );
}