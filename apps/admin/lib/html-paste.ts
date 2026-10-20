const FORMATTING_TAG =
  /<\/?(p|h[1-6]|ul|ol|li|strong|em|b|i|u|a|blockquote|pre|code|br|article|section|header|footer|main|div|span)\b[^>]*>/i;

export function looksLikeHtml(text: string) {
  const trimmed = text.trim();
  return trimmed.startsWith('<') && FORMATTING_TAG.test(trimmed);
}

function rename(element: Element, tag: string) {
  const replacement = element.ownerDocument.createElement(tag);
  replacement.innerHTML = element.innerHTML;
  element.replaceWith(replacement);
}

function collapseWhitespace(root: HTMLElement) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const node of textNodes) {
    if (node.parentElement?.closest('pre')) continue;
    node.data = node.data.replace(/\s+/g, ' ');
  }
}

export function parseHtml(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('script, style, iframe, object, embed, form').forEach((el) => el.remove());
  doc.querySelectorAll('h1').forEach((el) => rename(el, 'h2'));
  doc.querySelectorAll('h5, h6').forEach((el) => rename(el, 'h4'));
  collapseWhitespace(doc.body);

  return doc.body;
}