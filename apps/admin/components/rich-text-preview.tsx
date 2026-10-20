'use client';

import { useEffect, useState } from 'react';

const THEME = 'github-dark';

async function highlightCode(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = [...doc.querySelectorAll('pre > code')];
  if (blocks.length === 0) return html;

  const { codeToHtml } = await import('shiki');

  for (const code of blocks) {
    const source = code.textContent ?? '';
    const lang = [...code.classList].find((name) => name.startsWith('language-'))?.slice('language-'.length) ?? 'text';
    const highlighted = await codeToHtml(source, { lang, theme: THEME }).catch(() =>
      codeToHtml(source, { lang: 'text', theme: THEME }),
    );
    code.parentElement?.replaceWith(...new DOMParser().parseFromString(highlighted, 'text/html').body.childNodes);
  }

  return doc.body.innerHTML;
}

type Props = { html: string; emptyText: string };

export default function RichTextPreview({ html, emptyText }: Props) {
  const [rendered, setRendered] = useState(html);

  useEffect(() => {
    let cancelled = false;
    highlightCode(html).then((result) => {
      if (!cancelled) setRendered(result);
    });
    return () => {
      cancelled = true;
    };
  }, [html]);

  if (!html) return <p className="px-4 py-3 text-sm text-zinc-500">{emptyText}</p>;

  return <div className="rich-text px-4 py-3" dangerouslySetInnerHTML={{ __html: rendered }} />;
}