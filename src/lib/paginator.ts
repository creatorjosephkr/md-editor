import { PAPER_DIMENSIONS_MM, type DocumentTheme, type Orientation, type PaperSize, type PrintSettings } from '../types/print';

const PX_PER_INCH = 96;
const MM_PER_INCH = 25.4;

export function mmToPx(mm: number): number {
  return (mm * PX_PER_INCH) / MM_PER_INCH;
}

export function getPaperDimensionsMm(
  paperSize: PaperSize,
  orientation: Orientation,
): { widthMm: number; heightMm: number } {
  const base = PAPER_DIMENSIONS_MM[paperSize];
  if (orientation === 'landscape') {
    return { widthMm: base.height, heightMm: base.width };
  }
  return { widthMm: base.width, heightMm: base.height };
}

export function getContentAreaPx(settings: PrintSettings): {
  pageWidthPx: number;
  pageHeightPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
} {
  const { widthMm, heightMm } = getPaperDimensionsMm(settings.paperSize, settings.orientation);
  const pageWidthPx = mmToPx(widthMm);
  const pageHeightPx = mmToPx(heightMm);
  const contentWidthPx = Math.max(120, mmToPx(widthMm - settings.margins.left - settings.margins.right));
  const contentHeightPx = Math.max(120, mmToPx(heightMm - settings.margins.top - settings.margins.bottom));

  return {
    pageWidthPx,
    pageHeightPx,
    contentWidthPx,
    contentHeightPx,
  };
}

function isPageBreakNode(node: Element, hrAsPageBreak: boolean): boolean {
  if (node.classList.contains('page-break') || node.getAttribute('data-page-break') === 'true') {
    return true;
  }
  if (hrAsPageBreak && node.tagName === 'HR') {
    return true;
  }
  return false;
}

function isHeadingNode(node: Element): boolean {
  return /^H[1-4]$/.test(node.tagName);
}

function createMeasurementHost(contentWidthPx: number, docTheme: DocumentTheme, settings: PrintSettings): HTMLElement {
  const host = document.createElement('div');
  host.className = `md-doc theme-${docTheme}`;
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.visibility = 'hidden';
  host.style.pointerEvents = 'none';
  host.style.width = `${contentWidthPx}px`;
  host.style.boxSizing = 'border-box';
  host.style.setProperty('--doc-font-size', `${settings.fontSize}px`);
  host.style.setProperty('--doc-line-height', String(settings.lineHeight));
  document.body.appendChild(host);
  return host;
}

function splitTableIntoChunks(
  table: HTMLTableElement,
  availableHeightPx: number,
  fullPageHeightPx: number,
  measureHost: HTMLElement,
): HTMLTableElement[] {
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  const rows = tbody
    ? Array.from(tbody.querySelectorAll<HTMLElement>(':scope > tr'))
    : Array.from(table.querySelectorAll<HTMLElement>(':scope > tr'));

  if (rows.length <= 1) {
    return [table.cloneNode(true) as HTMLTableElement];
  }

  const chunks: HTMLTableElement[] = [];
  let currentRows: HTMLElement[] = [];
  let currentBudget = availableHeightPx;

  const makeTable = (sliceRows: HTMLElement[]): HTMLTableElement => {
    const clone = table.cloneNode(false) as HTMLTableElement;
    if (thead) clone.appendChild(thead.cloneNode(true));
    const bodyClone = document.createElement('tbody');
    for (const r of sliceRows) {
      bodyClone.appendChild(r.cloneNode(true));
    }
    clone.appendChild(bodyClone);
    return clone;
  };

  for (const row of rows) {
    const candidateRows = [...currentRows, row];
    const probe = makeTable(candidateRows);
    measureHost.innerHTML = '';
    measureHost.appendChild(probe);

    if (probe.getBoundingClientRect().height > currentBudget && currentRows.length > 0) {
      chunks.push(makeTable(currentRows));
      currentRows = [row];
      currentBudget = fullPageHeightPx;
    } else {
      currentRows = candidateRows;
    }
  }

  if (currentRows.length > 0) {
    chunks.push(makeTable(currentRows));
  }

  return chunks;
}

function splitListIntoChunks(
  list: HTMLUListElement | HTMLOListElement,
  availableHeightPx: number,
  fullPageHeightPx: number,
  measureHost: HTMLElement,
): HTMLElement[] {
  const items = Array.from(list.children).filter((el): el is HTMLElement => el.tagName === 'LI');
  if (items.length <= 1) {
    return [list.cloneNode(true) as HTMLElement];
  }

  const isOrdered = list.tagName === 'OL';
  const baseStart = isOrdered ? Number.parseInt(list.getAttribute('start') ?? '1', 10) || 1 : 1;
  const chunks: HTMLElement[] = [];
  let currentItems: HTMLElement[] = [];
  let currentStart = baseStart;
  let currentBudget = availableHeightPx;

  const makeList = (sliceItems: HTMLElement[], startIndex: number): HTMLElement => {
    const clone = list.cloneNode(false) as HTMLElement;
    if (isOrdered && startIndex !== 1) {
      clone.setAttribute('start', String(startIndex));
    }
    for (const item of sliceItems) {
      clone.appendChild(item.cloneNode(true));
    }
    return clone;
  };

  for (let idx = 0; idx < items.length; idx += 1) {
    const item = items[idx];
    const candidate = [...currentItems, item];
    const probe = makeList(candidate, currentStart);
    measureHost.innerHTML = '';
    measureHost.appendChild(probe);

    if (probe.getBoundingClientRect().height > currentBudget && currentItems.length > 0) {
      chunks.push(makeList(currentItems, currentStart));
      currentStart = baseStart + idx;
      currentItems = [item];
      currentBudget = fullPageHeightPx;
    } else {
      currentItems = candidate;
    }
  }

  if (currentItems.length > 0) {
    chunks.push(makeList(currentItems, currentStart));
  }

  return chunks;
}

export function paginateElement(
  sourceContainer: HTMLElement,
  settings: PrintSettings,
  docTheme: DocumentTheme,
): string[] {
  const { contentWidthPx, contentHeightPx } = getContentAreaPx(settings);
  const children = Array.from(sourceContainer.children);
  if (children.length === 0) {
    return [''];
  }

  const pageMeasureHost = createMeasurementHost(contentWidthPx, docTheme, settings);
  const subMeasureHost = createMeasurementHost(contentWidthPx, docTheme, settings);

  const pages: string[] = [];

  const flushPage = () => {
    if (pageMeasureHost.children.length > 0) {
      pages.push(pageMeasureHost.innerHTML);
      pageMeasureHost.innerHTML = '';
    }
  };

  const currentHeight = (): number => {
    if (pageMeasureHost.children.length === 0) return 0;
    return pageMeasureHost.scrollHeight;
  };

  try {
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];

      if (isPageBreakNode(child, settings.hrAsPageBreak)) {
        if (pageMeasureHost.children.length > 0) {
          flushPage();
        } else {
          pages.push('');
        }
        continue;
      }

      const cloned = child.cloneNode(true) as HTMLElement;
      pageMeasureHost.appendChild(cloned);
      const heightAfterAppend = currentHeight();

      if (heightAfterAppend <= contentHeightPx) {
        // Keep-with-next heuristic for headings near the bottom of a page
        if (isHeadingNode(child) && i + 1 < children.length && !isPageBreakNode(children[i + 1], settings.hrAsPageBreak)) {
          const nextProbe = children[i + 1].cloneNode(true) as HTMLElement;
          pageMeasureHost.appendChild(nextProbe);
          const withNextHeight = currentHeight();
          pageMeasureHost.removeChild(nextProbe);

          if (withNextHeight > contentHeightPx && pageMeasureHost.children.length > 1) {
            pageMeasureHost.removeChild(cloned);
            flushPage();
            pageMeasureHost.appendChild(cloned);
          }
        }
        continue;
      }

      // Exceeded page height: handle single-element splitting or moving to next page.
      pageMeasureHost.removeChild(cloned);
      const remainingHeightPx = Math.max(40, contentHeightPx - currentHeight());

      if (child.tagName === 'TABLE') {
        const chunks = splitTableIntoChunks(
          child as HTMLTableElement,
          pageMeasureHost.children.length > 0 ? remainingHeightPx : contentHeightPx,
          contentHeightPx,
          subMeasureHost,
        );
        for (let c = 0; c < chunks.length; c += 1) {
          const chunk = chunks[c];
          pageMeasureHost.appendChild(chunk);
          if (currentHeight() > contentHeightPx && pageMeasureHost.children.length > 1) {
            pageMeasureHost.removeChild(chunk);
            flushPage();
            pageMeasureHost.appendChild(chunk);
          }
          if (c < chunks.length - 1) {
            flushPage();
          }
        }
        continue;
      }

      if (child.tagName === 'UL' || child.tagName === 'OL') {
        const chunks = splitListIntoChunks(
          child as HTMLUListElement | HTMLOListElement,
          pageMeasureHost.children.length > 0 ? remainingHeightPx : contentHeightPx,
          contentHeightPx,
          subMeasureHost,
        );
        for (let c = 0; c < chunks.length; c += 1) {
          const chunk = chunks[c];
          pageMeasureHost.appendChild(chunk);
          if (currentHeight() > contentHeightPx && pageMeasureHost.children.length > 1) {
            pageMeasureHost.removeChild(chunk);
            flushPage();
            pageMeasureHost.appendChild(chunk);
          }
          if (c < chunks.length - 1) {
            flushPage();
          }
        }
        continue;
      }

      if (pageMeasureHost.children.length > 0) {
        flushPage();
      }
      pageMeasureHost.appendChild(cloned);
    }

    if (pageMeasureHost.children.length > 0 || pages.length === 0) {
      pages.push(pageMeasureHost.innerHTML);
    }
  } finally {
    pageMeasureHost.remove();
    subMeasureHost.remove();
  }

  return pages;
}
