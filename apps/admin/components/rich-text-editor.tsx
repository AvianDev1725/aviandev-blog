'use client';

import { useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor, JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  FileCode,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Underline,
  Unlink,
  type LucideIcon,
} from 'lucide-react';
import { insertHtml, pasteHtmlAsContent } from './html-paste';
import RichTextPreview from './rich-text-preview';

const codeLanguages = [
  ['typescript', 'TypeScript'],
  ['tsx', 'TSX'],
  ['javascript', 'JavaScript'],
  ['jsx', 'JSX'],
  ['css', 'CSS'],
  ['html', 'HTML'],
  ['json', 'JSON'],
  ['bash', 'Bash'],
] as const;

export type RichTextLabels = {
  toolbar: string;
  bold: string;
  italic: string;
  underline: string;
  heading2: string;
  heading3: string;
  bulletList: string;
  numberedList: string;
  quote: string;
  codeBlock: string;
  link: string;
  unlink: string;
  linkPrompt: string;
  codeLanguage: string;
  plainText: string;
  insertHtml: string;
  insertHtmlHint: string;
  insert: string;
  cancel: string;
  write: string;
  preview: string;
  previewEmpty: string;
};

type Props = {
  id: string;
  labelId: string;
  describedBy?: string;
  value: string | JSONContent;
  onChange: (value: string | JSONContent) => void;
  labels: RichTextLabels;
  output?: 'html' | 'json';
  minHeightClass?: string;
};

function toggleCode(editor: Editor) {
  const { state } = editor;
  const { $from, $to, empty } = state.selection;

  if (editor.isActive('codeBlock') || empty || $from.sameParent($to)) {
    editor.chain().focus().toggleCodeBlock().run();
    return;
  }

  const from = $from.before(1);
  const to = $to.after(1);
  const lines: string[] = [];
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isTextblock) {
      lines.push(node.textContent);
      return false;
    }
    return true;
  });
  const text = lines.join('\n');

  editor
    .chain()
    .focus()
    .insertContentAt({ from, to }, { type: 'codeBlock', content: text ? [{ type: 'text', text }] : [] })
    .run();
}

export default function RichTextEditor({
  id,
  labelId,
  describedBy,
  value,
  onChange,
  labels,
  output = 'html',
  minHeightClass = 'min-h-40',
}: Props) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        horizontalRule: false,
        link: { openOnClick: false },
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelId,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        class: `rich-text ${minHeightClass} px-3 py-2 outline-none`,
      },
      handlePaste: (view, event) => pasteHtmlAsContent(view, event),
    },
    onUpdate: ({ editor }) => onChange(output === 'json' ? editor.getJSON() : editor.isEmpty ? '' : editor.getHTML()),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            underline: editor.isActive('underline'),
            h2: editor.isActive('heading', { level: 2 }),
            h3: editor.isActive('heading', { level: 3 }),
            bulletList: editor.isActive('bulletList'),
            orderedList: editor.isActive('orderedList'),
            blockquote: editor.isActive('blockquote'),
            codeBlock: editor.isActive('codeBlock'),
            link: editor.isActive('link'),
            codeLanguage: (editor.getAttributes('codeBlock').language as string | null) ?? '',
          }
        : null,
  });

  function editLink() {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(labels.linkPrompt, previous ?? 'https://');
    if (url === null) return;

    const chain = editor.chain().focus().extendMarkRange('link');
    if (url.trim() === '') chain.unsetLink().run();
    else chain.setLink({ href: url.trim() }).run();
  }

  function closeHtmlPanel() {
    setHtmlOpen(false);
    setHtmlDraft('');
  }

  function submitHtml() {
    if (!editor || !htmlDraft.trim()) return;
    insertHtml(editor.view, htmlDraft);
    closeHtmlPanel();
    editor.commands.focus();
  }

  const buttons: { label: string; icon: LucideIcon; pressed?: boolean; run: () => void }[] = editor
    ? [
        { label: labels.bold, icon: Bold, pressed: active?.bold, run: () => editor.chain().focus().toggleBold().run() },
        { label: labels.italic, icon: Italic, pressed: active?.italic, run: () => editor.chain().focus().toggleItalic().run() },
        { label: labels.underline, icon: Underline, pressed: active?.underline, run: () => editor.chain().focus().toggleUnderline().run() },
        { label: labels.heading2, icon: Heading2, pressed: active?.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: labels.heading3, icon: Heading3, pressed: active?.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
        { label: labels.bulletList, icon: List, pressed: active?.bulletList, run: () => editor.chain().focus().toggleBulletList().run() },
        { label: labels.numberedList, icon: ListOrdered, pressed: active?.orderedList, run: () => editor.chain().focus().toggleOrderedList().run() },
        { label: labels.quote, icon: Quote, pressed: active?.blockquote, run: () => editor.chain().focus().toggleBlockquote().run() },
        { label: labels.codeBlock, icon: Code, pressed: active?.codeBlock, run: () => toggleCode(editor) },
        { label: labels.link, icon: LinkIcon, pressed: active?.link, run: editLink },
        { label: labels.unlink, icon: Unlink, run: () => editor.chain().focus().unsetLink().run() },
        { label: labels.insertHtml, icon: FileCode, pressed: htmlOpen, run: () => (htmlOpen ? closeHtmlPanel() : setHtmlOpen(true)) },
      ]
    : [];

  const tabClass = (selected: boolean) =>
    `rounded-md px-3 py-1 text-xs font-medium ${selected ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-600 hover:text-zinc-900'}`;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-300 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900">
      <div className="flex gap-1 border-b border-zinc-200 bg-zinc-100 p-1">
        <button type="button" aria-pressed={mode === 'write'} onClick={() => setMode('write')} className={tabClass(mode === 'write')}>
          {labels.write}
        </button>
        <button type="button" aria-pressed={mode === 'preview'} onClick={() => setMode('preview')} className={tabClass(mode === 'preview')}>
          {labels.preview}
        </button>
      </div>

      {mode === 'write' && (
        <div role="toolbar" aria-label={labels.toolbar} className="flex flex-wrap gap-1 border-b border-zinc-200 bg-zinc-50 p-1">
          {buttons.map(({ label, icon: Icon, pressed, run }) => (
            <button
              key={label}
              type="button"
              onClick={run}
              aria-label={label}
              aria-pressed={pressed === undefined ? undefined : pressed}
              title={label}
              className={`rounded-md p-1.5 ${pressed ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-200'}`}
            >
              <Icon size={16} aria-hidden />
            </button>
          ))}
          {editor && active?.codeBlock && (
            <select
              aria-label={labels.codeLanguage}
              value={active.codeLanguage}
              onChange={(e) =>
                editor.chain().focus().updateAttributes('codeBlock', { language: e.target.value || null }).run()
              }
              className="ml-auto rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
            >
              <option value="">{labels.plainText}</option>
              {codeLanguages.map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {mode === 'write' && htmlOpen && (
        <div className="space-y-2 border-b border-zinc-200 bg-zinc-50 p-3">
          <label htmlFor={`${id}-html`} className="block text-xs text-zinc-600">
            {labels.insertHtmlHint}
          </label>
          <textarea
            id={`${id}-html`}
            value={htmlDraft}
            onChange={(e) => setHtmlDraft(e.target.value)}
            rows={8}
            autoFocus
            spellCheck={false}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitHtml}
              disabled={!htmlDraft.trim()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {labels.insert}
            </button>
            <button type="button" onClick={closeHtmlPanel} className="rounded-md px-3 py-1.5 text-xs ring-1 ring-zinc-300">
              {labels.cancel}
            </button>
          </div>
        </div>
      )}

      <div className={mode === 'write' ? '' : 'hidden'}>
        <EditorContent editor={editor} />
      </div>

      {mode === 'preview' && (
        <div className={minHeightClass}>
          <RichTextPreview html={editor && !editor.isEmpty ? editor.getHTML() : ''} emptyText={labels.previewEmpty} />
        </div>
      )}
    </div>
  );
}