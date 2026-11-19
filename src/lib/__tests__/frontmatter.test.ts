import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../frontmatter';

describe('parseFrontmatter', () => {
  it('parses Korean frontmatter fields, inline tags, and returns accurate lineOffset', () => {
    const input = [
      '---',
      'title: "분기별 실적 보고서"',
      'author: 홍길동',
      'date: 2026-11-19',
      'tags: [보고서, 인쇄, "2026 Q4"]',
      '---',
      '# 본문 제목',
      '내용입니다.',
    ].join('\n');

    const result = parseFrontmatter(input);
    expect(result.data.title).toBe('분기별 실적 보고서');
    expect(result.data.author).toBe('홍길동');
    expect(result.data.date).toBe('2026-11-19');
    expect(result.data.tags).toEqual(['보고서', '인쇄', '2026 Q4']);
    expect(result.lineOffset).toBe(6);
    expect(result.body).toBe('# 본문 제목\n내용입니다.');
  });

  it('parses multiline YAML list items for tags', () => {
    const input = [
      '---',
      'title: 노트',
      'tags:',
      '  - 마크다운',
      '  - 수식',
      '---',
      '본문',
    ].join('\n');

    const result = parseFrontmatter(input);
    expect(result.data.title).toBe('노트');
    expect(result.data.tags).toEqual(['마크다운', '수식']);
    expect(result.lineOffset).toBe(6);
  });

  it('returns original body and lineOffset 0 when no frontmatter exists', () => {
    const input = '# 일반 문서\n\n---\n\n구분선 아래';
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({});
    expect(result.lineOffset).toBe(0);
    expect(result.body).toBe(input);
  });

  it('ignores unclosed frontmatter blocks', () => {
    const input = '---\ntitle: 미완성\n# 제목';
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({});
    expect(result.lineOffset).toBe(0);
    expect(result.body).toBe(input);
  });
});
