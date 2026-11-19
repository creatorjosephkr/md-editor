import { describe, expect, it } from 'vitest';
import { getContentAreaPx, getPaperDimensionsMm, mmToPx, paginateElement } from '../paginator';
import { DEFAULT_PRINT_SETTINGS } from '../../types/print';

describe('paginator geometry', () => {
  it('converts millimeters to 96-DPI CSS pixels accurately', () => {
    expect(mmToPx(25.4)).toBeCloseTo(96, 5);
  });

  it('returns portrait and landscape dimensions for all supported paper sizes', () => {
    expect(getPaperDimensionsMm('A4', 'portrait')).toEqual({ widthMm: 210, heightMm: 297 });
    expect(getPaperDimensionsMm('A4', 'landscape')).toEqual({ widthMm: 297, heightMm: 210 });
    expect(getPaperDimensionsMm('Letter', 'portrait')).toEqual({ widthMm: 215.9, heightMm: 279.4 });
    expect(getPaperDimensionsMm('Legal', 'landscape')).toEqual({ widthMm: 355.6, heightMm: 215.9 });
    expect(getPaperDimensionsMm('B5', 'portrait')).toEqual({ widthMm: 176, heightMm: 250 });
  });

  it('subtracts margins when computing printable content area', () => {
    const area = getContentAreaPx({
      ...DEFAULT_PRINT_SETTINGS,
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 20, right: 15, bottom: 20, left: 15 },
    });

    expect(area.pageWidthPx).toBeCloseTo(mmToPx(210), 4);
    expect(area.pageHeightPx).toBeCloseTo(mmToPx(297), 4);
    expect(area.contentWidthPx).toBeCloseTo(mmToPx(180), 4);
    expect(area.contentHeightPx).toBeCloseTo(mmToPx(257), 4);
  });
});

describe('paginateElement', () => {
  it('splits pages at explicit .page-break nodes and respects hrAsPageBreak', () => {
    const container = document.createElement('div');
    container.innerHTML = [
      '<p>페이지 1</p>',
      '<div class="page-break" data-page-break="true"></div>',
      '<p>페이지 2</p>',
      '<hr />',
      '<p>페이지 3</p>',
    ].join('');

    const pagesWithoutHr = paginateElement(
      container,
      { ...DEFAULT_PRINT_SETTINGS, hrAsPageBreak: false },
      'github',
    );
    expect(pagesWithoutHr).toHaveLength(2);
    expect(pagesWithoutHr[0]).toContain('페이지 1');
    expect(pagesWithoutHr[1]).toContain('페이지 2');
    expect(pagesWithoutHr[1]).toContain('페이지 3');

    const pagesWithHr = paginateElement(
      container,
      { ...DEFAULT_PRINT_SETTINGS, hrAsPageBreak: true },
      'github',
    );
    expect(pagesWithHr).toHaveLength(3);
    expect(pagesWithHr[0]).toContain('페이지 1');
    expect(pagesWithHr[1]).toContain('페이지 2');
    expect(pagesWithHr[2]).toContain('페이지 3');
  });
});
