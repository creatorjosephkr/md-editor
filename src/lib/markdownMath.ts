import katex from 'katex';
import type { MarkdownIt, StateBlock, StateInline, Token } from 'markdown-it';

function isEscaped(src: string, pos: number): boolean {
  let backslashes = 0;
  let i = pos - 1;
  while (i >= 0 && src[i] === '\\') {
    backslashes += 1;
    i -= 1;
  }
  return backslashes % 2 === 1;
}

function isValidInlineMathBounds(src: string, openPos: number, closePos: number): boolean {
  const afterOpen = src[openPos + 1];
  const beforeClose = src[closePos - 1];
  if (!afterOpen || !beforeClose) return false;
  if (afterOpen === ' ' || afterOpen === '\t' || afterOpen === '\n') return false;
  if (beforeClose === ' ' || beforeClose === '\t' || beforeClose === '\n') return false;

  // Reject price patterns like "$5 and $10" where the closing "$" precedes a digit.
  const afterClose = src[closePos + 1];
  if (afterClose && /\d/.test(afterClose)) {
    return false;
  }

  return true;
}

function mathInlineRule(state: StateInline, silent: boolean): boolean {
  const start = state.pos;
  const src = state.src;

  if (src[start] !== '$') return false;
  if (isEscaped(src, start)) return false;

  // Let block math ($$) be handled by block rule or ignore empty $$ inline.
  if (src[start + 1] === '$') return false;

  const afterOpen = src[start + 1];
  if (!afterOpen || afterOpen === ' ' || afterOpen === '\t' || afterOpen === '\n') {
    return false;
  }

  let match = -1;
  let pos = start + 1;
  while (pos < state.posMax) {
    if (src[pos] === '$' && !isEscaped(src, pos)) {
      if (src[pos + 1] === '$') {
        pos += 2;
        continue;
      }
      if (isValidInlineMathBounds(src, start, pos)) {
        match = pos;
        break;
      }
    }
    pos += 1;
  }

  if (match === -1) return false;

  const content = src.slice(start + 1, match);
  if (!content || content.includes('\n\n')) return false;

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '$';
    token.content = content;
  }

  state.pos = match + 1;
  return true;
}

function mathBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const startPos = state.bMarks[startLine] + state.tShift[startLine];
  const maxPos = state.eMarks[startLine];

  if (startPos + 2 > maxPos) return false;
  if (state.src.slice(startPos, startPos + 2) !== '$$') return false;

  const firstLineRest = state.src.slice(startPos + 2, maxPos).trim();

  // Single-line $$ ... $$
  if (firstLineRest.endsWith('$$') && firstLineRest.length >= 2) {
    if (silent) return true;
    const content = firstLineRest.slice(0, -2).trim();
    const token = state.push('math_block', 'math', 0);
    token.block = true;
    token.markup = '$$';
    token.content = content;
    token.map = [startLine, startLine + 1];
    state.line = startLine + 1;
    return true;
  }

  let nextLine = startLine + 1;
  let foundClosing = false;

  while (nextLine < endLine) {
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const lineEnd = state.eMarks[nextLine];
    const lineText = state.src.slice(lineStart, lineEnd).trim();

    if (lineText === '$$' || lineText.endsWith('$$')) {
      foundClosing = true;
      break;
    }
    nextLine += 1;
  }

  if (!foundClosing) return false;
  if (silent) return true;

  const lines: string[] = [];
  if (firstLineRest.length > 0) {
    lines.push(firstLineRest);
  }
  for (let i = startLine + 1; i < nextLine; i += 1) {
    const ls = state.bMarks[i];
    const le = state.eMarks[i];
    lines.push(state.src.slice(ls, le));
  }

  const closingStart = state.bMarks[nextLine] + state.tShift[nextLine];
  const closingEnd = state.eMarks[nextLine];
  const closingText = state.src.slice(closingStart, closingEnd).trim();
  if (closingText.length > 2 && closingText.endsWith('$$')) {
    lines.push(closingText.slice(0, -2).trimEnd());
  }

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.markup = '$$';
  token.content = lines.join('\n').trim();
  token.map = [startLine, nextLine + 1];
  state.line = nextLine + 1;
  return true;
}

export function markdownItKatex(md: MarkdownIt, getLineOffset: () => number): void {
  md.inline.ruler.after('escape', 'math_inline', mathInlineRule);
  md.block.ruler.after('blockquote', 'math_block', mathBlockRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });

  md.renderer.rules.math_inline = (tokens: Token[], idx: number) => {
    const content = tokens[idx].content;
    try {
      const rendered = katex.renderToString(content, {
        displayMode: false,
        throwOnError: false,
        strict: 'ignore',
      });
      return `<span class="math-inline">${rendered}</span>`;
    } catch {
      return `<code class="math-error">${md.utils.escapeHtml(content)}</code>`;
    }
  };

  md.renderer.rules.math_block = (tokens: Token[], idx: number) => {
    const token = tokens[idx];
    const lineAttr =
      token.map && token.map.length > 0
        ? ` data-source-line="${token.map[0] + 1 + getLineOffset()}"`
        : '';
    try {
      const rendered = katex.renderToString(token.content, {
        displayMode: true,
        throwOnError: false,
        strict: 'ignore',
      });
      return `<div class="math-block"${lineAttr}>${rendered}</div>\n`;
    } catch {
      return `<pre class="math-error"${lineAttr}>${md.utils.escapeHtml(token.content)}</pre>\n`;
    }
  };
}
