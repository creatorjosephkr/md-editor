import { describe, expect, it } from 'vitest';
import { renderMarkdown, resolveLocalAssetUrl, slugifyHeading } from '../markdown';

describe('slugifyHeading', () => {
  it('preserves Korean Hangul, ASCII letters, numbers, and hyphens', () => {
    expect(slugifyHeading('1. 먹(Meok) 시작하기')).toBe('1-먹meok-시작하기');
    expect(slugifyHeading('한글 제목 테스트!')).toBe('한글-제목-테스트');
  });
});

describe('resolveLocalAssetUrl', () => {
  it('rewrites relative image paths to md-asset:// when filePath is given', () => {
    const resolved = resolveLocalAssetUrl('./images/chart.png', '/Users/test/docs/guide.md');
    expect(resolved).toBe('md-asset://local?path=%2FUsers%2Ftest%2Fdocs%2Fimages%2Fchart.png');

    const parentResolved = resolveLocalAssetUrl('../assets/photo.jpg', '/Users/test/docs/guide.md');
    expect(parentResolved).toBe('md-asset://local?path=%2FUsers%2Ftest%2Fassets%2Fphoto.jpg');
  });

  it('keeps external https and data URLs unchanged', () => {
    expect(resolveLocalAssetUrl('https://example.com/a.png', '/Users/test/doc.md')).toBe(
      'https://example.com/a.png',
    );
    expect(resolveLocalAssetUrl('data:image/png;base64,AAA', '/Users/test/doc.md')).toBe(
      'data:image/png;base64,AAA',
    );
  });
});

describe('renderMarkdown', () => {
  it('renders GFM tables, syntax-highlighted code blocks, and interactive checklists with frontmatter offset', () => {
    const md = [
      '---',
      'title: 테스트 문서',
      '---',
      '',
      '- [ ] 첫 번째 할 일',
      '- [x] 완료된 할 일',
      '',
      '| 이름 | 점수 |',
      '| --- | --- |',
      '| 가 | 100 |',
      '',
      '```ts',
      'const x: number = 42;',
      '```',
    ].join('\n');

    const result = renderMarkdown(md);
    expect(result.frontmatter.title).toBe('테스트 문서');
    expect(result.html).toContain('class="task-list-item"');
    expect(result.html).toContain('type="checkbox"');
    expect(result.html).toContain('type="button"');
    expect(result.html).toContain('data-source-line="5"');
    expect(result.html).toContain('data-source-line="6"');
    expect(result.html).toContain('checked');
    expect(result.html).toContain('<table ');
    expect(result.html).toContain('hljs language-ts');
  });

  it('renders KaTeX inline and block math while avoiding false positives on currency', () => {
    const md = [
      '인라인 수식 $E = mc^2$ 와 가격 $5 and $10 또는 커피 $5, 노트 $10 테스트.',
      '',
      '$$',
      '\\int_0^1 x^2 \\, dx = \\frac{1}{3}',
      '$$',
    ].join('\n');

    const result = renderMarkdown(md);
    expect(result.html).toContain('class="math-inline"');
    expect(result.html).toContain('class="math-block"');
    expect(result.html).toContain('katex');
    expect(result.html).toContain('$5 and $10');
    expect(result.html).toContain('커피 $5, 노트 $10');
  });

  it('emits encoded mermaid blocks and deduplicates Korean TOC slugs', () => {
    const md = [
      '# 소개',
      '## 세부 내용',
      '# 소개',
      '',
      '```mermaid',
      'flowchart LR',
      '  A[시작] --> B[끝]',
      '```',
    ].join('\n');

    const result = renderMarkdown(md);
    expect(result.toc.map((t) => ({ id: t.id, level: t.level, text: t.text }))).toEqual([
      { id: '소개', level: 1, text: '소개' },
      { id: '세부-내용', level: 2, text: '세부 내용' },
      { id: '소개-1', level: 1, text: '소개' },
    ]);
    expect(result.html).toContain('class="mermaid-block"');
    expect(result.html).toContain(encodeURIComponent('flowchart LR\n  A[시작] --> B[끝]'));
  });

  it('renders page break markers and optional hrAsPageBreak class', () => {
    const md = '첫 페이지\n\n<!-- pagebreak -->\n\n---\n\n마지막';
    const withoutHr = renderMarkdown(md, { hrAsPageBreak: false });
    expect(withoutHr.html).toContain('data-page-break="true"');
    expect(withoutHr.html).not.toContain('hr-page-break');

    const withHr = renderMarkdown(md, { hrAsPageBreak: true });
    expect(withHr.html).toContain('class="hr-page-break"');
  });

  it('sanitizes XSS payloads while preserving md-asset images, data images, and KaTeX markup', () => {
    const md = [
      '![도표](./diagram.png)',
      '![인라인](data:image/png;base64,iVBORw0KGgo=)',
      '[안전하지 않은 마크다운 링크](javascript:alert(1))',
      '<a href="javascript:alert(1)">악성 HTML 링크</a>',
      '',
      '<script>window.__xss = true;</script>',
      '<img src="x" onerror="alert(1)" />',
      '',
      '수식 $a + b$',
    ].join('\n');

    const result = renderMarkdown(md, { filePath: '/docs/readme.md' });
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('onerror');
    expect(result.html).not.toContain('href="javascript:');
    expect(result.html).toContain('<a>악성 HTML 링크</a>');
    expect(result.html).toContain('md-asset://local?path=%2Fdocs%2Fdiagram.png');
    expect(result.html).toContain('data:image/png;base64,iVBORw0KGgo=');
    expect(result.html).toContain('class="katex"');
  });
});
