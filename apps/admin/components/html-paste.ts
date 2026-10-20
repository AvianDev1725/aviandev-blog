import { DOMParser as ProseMirrorParser } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { looksLikeHtml, parseHtml } from '@/lib/html-paste';

function inCodeBlock(view: EditorView) {
  return Boolean(view.state.selection.$from.parent.type.spec.code);
}

export function insertHtml(view: EditorView, html: string) {
  const slice = ProseMirrorParser.fromSchema(view.state.schema).parseSlice(parseHtml(html));
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
}

export function pasteHtmlAsContent(view: EditorView, event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (!text) return false;

  if (inCodeBlock(view)) {
    view.dispatch(view.state.tr.insertText(text).scrollIntoView());
    return true;
  }

  if (!looksLikeHtml(text)) return false;

  insertHtml(view, text);
  return true;
}