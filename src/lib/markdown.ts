import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import MarkdownIt, { type StateBlock, type Token } from 'markdown-it';
import type { FrontmatterData, TocItem } from '../types/document';
import { parseFrontmatter } from './frontmatter';
import { markdownItKatex } from './markdownMath';

export interface RenderMarkdownOptions {
  filePath?: string | null;
  hrAsPageBreak?: boolean;
}

export interface RenderedMarkdownResult {
  html: string;
  toc: TocItem[];
  frontmatter: FrontmatterData;
  wordCount: number;
  charCount: number;
  readingMinutes: number;
}

const PAGE_BREAK_PATTERN =
  /^(?:<!--\s*page-?break\s*-->|\\pagebreak|<div\s+class=["']page-break["']\s*>\s*<\/div>)$/i;

export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

function getDirname(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) return '.';
  if (lastSlash === 0) return '/';
  return normalized.slice(0, lastSlash);
}

function resolvePosixPath(baseDir: string, relativePart: string): string {
  const cleanRel = relativePart.split(/[?#]/)[0];
  let decodedRel = cleanRel;
  try {
    decodedRel = decodeURIComponent(cleanRel);
  } catch {
    // keep raw if malformed URI encoding
  }

  if (decodedRel.startsWith('/') || /^[A-Za-z]:\//.test(decodedRel)) {
    return decodedRel;
  }

  const stack = baseDir.replaceAll('\\', '/').split('/').filter((seg, idx) => idx === 0 || seg.length > 0);
  const relSegments = decodedRel.replaceAll('\\', '/').split('/');

  for (const segment of relSegments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (stack.length > 1 || (stack.length === 1 && stack[0] !== '')) {
        stack.pop();
      }
    } else {
      stack.push(segment);
    }
  }

  if (baseDir.startsWith('/')) {
    const joined = stack.filter(Boolean).join('/');
    return `/${joined}`;
  }
  return stack.join('/');
}

export function resolveLocalAssetUrl(src: string, filePath?: string | null): string {
  const trimmed = src.trim();
  if (!trimmed) return trimmed;
  if (/^(?:https?:|data:|blob:|md-asset:|mailto:|#)/i.test(trimmed)) {
    return trimmed;
  }
  if (!filePath) {
    return trimmed;
  }

  const resolved = resolvePosixPath(getDirname(filePath), trimmed);
  return `md-asset://local?path=${encodeURIComponent(resolved)}`;
}

function pageBreakBlockRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  const startPos = state.bMarks[startLine] + state.tShift[startLine];
  const maxPos = state.eMarks[startLine];
  const line = state.src.slice(startPos, maxPos).trim();

  if (!PAGE_BREAK_PATTERN.test(line)) {
    return false;
  }
  if (silent) return true;

  const token = state.push('page_break', 'div', 0);
  token.block = true;
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

function extractInlineText(token: Token): string {
  if (!token.children || token.children.length === 0) {
    return token.content;
  }
  return token.children
    .map((child) => {
      if (child.type === 'text' || child.type === 'code_inline') {
        return child.content;
      }
      if (child.type === 'math_inline') {
        return child.content;
      }
      if (child.type === 'softbreak' || child.type === 'hardbreak') {
        return ' ';
      }
      return '';
    })
    .join('')
    .trim();
}

function computeStats(body: string): { wordCount: number; charCount: number; readingMinutes: number } {
  const trimmed = body.trim();
  if (!trimmed) {
    return { wordCount: 0, charCount: 0, readingMinutes: 0 };
  }
  const charCount = trimmed.length;
  const charNoSpaces = trimmed.replace(/\s+/g, '').length;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(Math.max(wordCount, charNoSpaces / 3.5) / 200));
  return { wordCount, charCount, readingMinutes };
}

export function renderMarkdown(
  rawMarkdown: string,
  options: RenderMarkdownOptions = {},
): RenderedMarkdownResult {
  const { data: frontmatter, body, lineOffset } = parseFrontmatter(rawMarkdown);
  const toc: TocItem[] = [];
  const slugCounts = new Map<string, number>();

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
  });

  markdownItKatex(md, () => lineOffset);

  md.block.ruler.before('html_block', 'page_break', pageBreakBlockRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });

  // Annotate task lists and headings + source line mapping in core pipeline.
  md.core.ruler.after('inline', 'meok_annotations', (state) => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];

      // Source line attribute on block opening tokens
      if (token.map && token.nesting >= 0 && token.type !== 'inline') {
        const lineNum = token.map[0] + 1 + lineOffset;
        token.attrSet('data-source-line', String(lineNum));
      }

      // Collect headings and assign unique slug IDs
      if (token.type === 'heading_open' && tokens[i + 1]?.type === 'inline') {
        const level = Number.parseInt(token.tag.slice(1), 10) || 1;
        const inlineToken = tokens[i + 1];
        const text = extractInlineText(inlineToken);
        const baseSlug = slugifyHeading(text);
        const count = slugCounts.get(baseSlug) ?? 0;
        slugCounts.set(baseSlug, count + 1);
        const uniqueId = count === 0 ? baseSlug : `${baseSlug}-${count}`;
        const line = token.map ? token.map[0] + 1 + lineOffset : 1 + lineOffset;

        token.attrSet('id', uniqueId);
        toc.push({ id: uniqueId, text: text || '제목', level, line });
      }

      // GFM task list item conversion
      if (token.type === 'list_item_open') {
        const next1 = tokens[i + 1];
        const next2 = tokens[i + 2];
        if (next1?.type === 'paragraph_open' && next2?.type === 'inline' && next2.children?.length) {
          const firstChild = next2.children[0];
          if (firstChild.type === 'text') {
            const match = firstChild.content.match(/^\[([ xX])\]\s+(.*)$/);
            if (match) {
              const checked = match[1].toLowerCase() === 'x';
              firstChild.content = match[2];
              const existingClass = token.attrGet('class');
              token.attrSet('class', existingClass ? `${existingClass} task-list-item` : 'task-list-item');

              const line = token.map ? token.map[0] + 1 + lineOffset : 1 + lineOffset;
              const checkboxToken = new state.Token('html_inline', '', 0);
              checkboxToken.content = `<input type="checkbox" class="task-list-checkbox" data-source-line="${line}"${checked ? ' checked' : ''} /> `;
              next2.children.unshift(checkboxToken);
            }
          }
        }
      }
    }
  });

  md.renderer.rules.page_break = (tokens, idx) => {
    const token = tokens[idx];
    const lineAttr = token.map ? ` data-source-line="${token.map[0] + 1 + lineOffset}"` : '';
    return `<div class="page-break" data-page-break="true"${lineAttr}><span class="page-break-label">페이지 나누기</span></div>\n`;
  };

  const defaultHrRenderer =
    md.renderer.rules.hr ?? ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.hr = (tokens, idx, opts, env, self) => {
    if (options.hrAsPageBreak) {
      tokens[idx].attrSet('class', 'hr-page-break');
    }
    return defaultHrRenderer(tokens, idx, opts, env, self);
  };

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = token.info ? md.utils.unescapeAll(token.info).trim() : '';
    const lang = info.split(/\s+/g)[0]?.toLowerCase() ?? '';
    const lineAttr = token.map ? ` data-source-line="${token.map[0] + 1 + lineOffset}"` : '';

    if (lang === 'mermaid') {
      const encoded = encodeURIComponent(token.content.trim());
      return `<div class="mermaid-block"${lineAttr} data-mermaid-code="${encoded}"></div>\n`;
    }

    let highlighted = '';
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(token.content, { language: lang, ignoreIllegals: true }).value;
      } catch {
        highlighted = md.utils.escapeHtml(token.content);
      }
    } else {
      highlighted = md.utils.escapeHtml(token.content);
    }

    const escapedLang = md.utils.escapeHtml(lang);
    const label = escapedLang || 'text';
    const langClass = escapedLang ? ` language-${escapedLang}` : '';
    return (
      `<div class="code-block-wrapper" data-lang="${escapedLang}"${lineAttr}>` +
      `<div class="code-block-header">` +
      `<span class="code-lang-label">${label}</span>` +
      `<button type="button" class="copy-code-btn" data-copy-code="true">복사</button>` +
      `</div>` +
      `<pre><code class="hljs${langClass}">${highlighted}</code></pre>` +
      `</div>\n`
    );
  };

  const defaultImageRenderer =
    md.renderer.rules.image ?? ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.image = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet('src');
    if (typeof src === 'string' && src.length > 0) {
      token.attrSet('src', resolveLocalAssetUrl(src, options.filePath));
    }
    return defaultImageRenderer(tokens, idx, opts, env, self);
  };

  const defaultLinkOpen =
    md.renderer.rules.link_open ?? ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const href = String(token.attrGet('href') ?? '');
    if (/^https?:\/\//i.test(href)) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
    }
    return defaultLinkOpen(tokens, idx, opts, env, self);
  };

  const rawHtml = md.render(body);
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: [
      'input',
      'button',
      'math',
      'semantics',
      'mrow',
      'mi',
      'mo',
      'mn',
      'msup',
      'msub',
      'msubsup',
      'mfrac',
      'mroot',
      'msqrt',
      'mtable',
      'mtr',
      'mtd',
      'mtext',
      'mspace',
      'annotation',
    ],
    ADD_ATTR: [
      'type',
      'checked',
      'disabled',
      'data-source-line',
      'data-mermaid-code',
      'data-page-break',
      'data-lang',
      'data-copy-code',
      'aria-hidden',
      'encoding',
      'target',
      'rel',
    ],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|md-asset):|data:image\/|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });

  const stats = computeStats(body);
  return {
    html: cleanHtml,
    toc,
    frontmatter,
    ...stats,
  };
}
