import type { RenderedMarkdownResult } from './markdown';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildFrontmatterHtml(rendered: RenderedMarkdownResult): string {
  const { title, author, date, description, tags } = rendered.frontmatter;
  const hasAny = Boolean(title || author || date || description || (tags && tags.length > 0));
  if (!hasAny) return '';

  const parts: string[] = ['<header class="doc-frontmatter-card">'];
  if (title) {
    parts.push(`<div class="doc-frontmatter-title">${escapeHtml(title)}</div>`);
  }
  if (description) {
    parts.push(`<div style="margin-bottom:0.45em;font-size:0.92em;color:var(--doc-muted);">${escapeHtml(description)}</div>`);
  }
  if (author || date) {
    parts.push('<div class="doc-frontmatter-meta">');
    if (author) parts.push(`<span>작성: ${escapeHtml(author)}</span>`);
    if (date) parts.push(`<span>날짜: ${escapeHtml(date)}</span>`);
    parts.push('</div>');
  }
  if (tags && tags.length > 0) {
    parts.push('<div class="doc-frontmatter-tags">');
    for (const tag of tags) {
      parts.push(`<span class="doc-frontmatter-tag">#${escapeHtml(tag)}</span>`);
    }
    parts.push('</div>');
  }
  parts.push('</header>');
  return parts.join('');
}

export function buildDocumentHtmlFragment(rendered: RenderedMarkdownResult): string {
  return `${buildFrontmatterHtml(rendered)}${rendered.html}`;
}

export function resolveDocumentTitle(
  rendered: RenderedMarkdownResult,
  fallbackFileName: string,
): string {
  if (rendered.frontmatter.title?.trim()) {
    return rendered.frontmatter.title.trim();
  }
  const h1 = rendered.toc.find((item) => item.level === 1);
  if (h1?.text?.trim()) {
    return h1.text.trim();
  }
  return fallbackFileName.replace(/\.(md|markdown|mdx|txt)$/i, '') || '제목 없음';
}
