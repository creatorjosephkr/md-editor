import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { FileDown, Eye, Printer, ZoomIn, ZoomOut } from 'lucide-react';
import { buildDocumentHtmlFragment } from '../lib/documentHtml';
import type { RenderedMarkdownResult } from '../lib/markdown';
import { hydrateMermaidBlocks } from '../lib/mermaidRenderer';
import { getContentAreaPx, mmToPx, paginateElement } from '../lib/paginator';
import { PAPER_DIMENSIONS_MM, type DocumentTheme, type FooterFormat, type PrintSettings } from '../types/print';

export interface PrintPreviewHandle {
  scrollToHeading: (id: string) => void;
}

interface PrintPreviewProps {
  rendered: RenderedMarkdownResult;
  title: string;
  docTheme: DocumentTheme;
  printSettings: PrintSettings;
  isExporting: boolean;
  onPrint: () => void;
  onExportPdf: () => void;
}

function formatPageNumber(pageIndex: number, totalPages: number, format: FooterFormat): string {
  const current = pageIndex + 1;
  switch (format) {
    case 'dash':
      return `- ${current} -`;
    case 'pageOf':
      return `Page ${current} of ${totalPages}`;
    case 'slash':
    default:
      return `${current} / ${totalPages}`;
  }
}

async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  if (images.length === 0) return;

  await Promise.race([
    Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        });
      }),
    ),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]);
}

export const PrintPreview = forwardRef<PrintPreviewHandle, PrintPreviewProps>(function PrintPreview(
  { rendered, title, docTheme, printSettings, isExporting, onPrint, onExportPdf },
  ref,
) {
  const deskRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<string[]>(['']);
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [deskWidth, setDeskWidth] = useState<number>(860);
  const [showMargins, setShowMargins] = useState<boolean>(false);

  const documentHtml = useMemo(() => buildDocumentHtmlFragment(rendered), [rendered]);
  const metrics = useMemo(() => getContentAreaPx(printSettings), [printSettings]);

  // Observe desk container width for "fit" zoom
  useEffect(() => {
    const el = deskRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDeskWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Paginate offscreen whenever document or print settings change
  useEffect(() => {
    let cancelled = false;

    async function runPagination() {
      const staging = document.createElement('div');
      staging.className = `md-doc theme-${docTheme}`;
      staging.style.position = 'fixed';
      staging.style.left = '-99999px';
      staging.style.top = '0';
      staging.style.visibility = 'hidden';
      staging.style.pointerEvents = 'none';
      staging.style.width = `${metrics.contentWidthPx}px`;
      staging.style.setProperty('--doc-font-size', `${printSettings.fontSize}px`);
      staging.style.setProperty('--doc-line-height', String(printSettings.lineHeight));
      staging.innerHTML = documentHtml;
      document.body.appendChild(staging);

      try {
        await hydrateMermaidBlocks(staging, 'light');
        await waitForImages(staging);
        if (cancelled) return;
        const computedPages = paginateElement(staging, printSettings, docTheme);
        if (!cancelled) {
          setPages(computedPages);
        }
      } finally {
        staging.remove();
      }
    }

    void runPagination();
    return () => {
      cancelled = true;
    };
  }, [documentHtml, docTheme, printSettings, metrics.contentWidthPx]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToHeading(id: string) {
        const desk = deskRef.current;
        if (!desk) return;
        const target = Array.from(desk.querySelectorAll<HTMLElement>('[id]')).find(
          (el) => el.id === id,
        );
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    }),
    [],
  );

  const zoomScale = useMemo(() => {
    if (zoomMode !== 'fit') return zoomMode;
    const available = Math.max(320, deskWidth - 64);
    return Math.min(1.05, Math.max(0.35, available / metrics.pageWidthPx));
  }, [zoomMode, deskWidth, metrics.pageWidthPx]);

  const topMarginPx = mmToPx(printSettings.margins.top);
  const rightMarginPx = mmToPx(printSettings.margins.right);
  const bottomMarginPx = mmToPx(printSettings.margins.bottom);
  const leftMarginPx = mmToPx(printSettings.margins.left);

  const headerResolved = (printSettings.headerText || '{{title}}').replaceAll('{{title}}', title);

  const stepZoom = (delta: number) => {
    const base = zoomMode === 'fit' ? zoomScale : zoomMode;
    const next = Math.round(Math.min(1.5, Math.max(0.35, base + delta)) * 100) / 100;
    setZoomMode(next);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Print Preview Toolbar */}
      <div
        className="no-print flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs select-none"
        style={{
          backgroundColor: 'var(--bg-sidebar)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="rounded-md border px-2 py-0.5 font-semibold"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            총 {pages.length} 페이지
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {PAPER_DIMENSIONS_MM[printSettings.paperSize].label} ·{' '}
            {printSettings.orientation === 'portrait' ? '세로' : '가로'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowMargins((prev) => !prev)}
            className="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs transition-colors"
            style={{
              backgroundColor: showMargins ? 'var(--accent-soft)' : 'var(--bg-surface)',
              borderColor: showMargins ? 'var(--accent)' : 'var(--border-subtle)',
              color: showMargins ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Eye size={12} />
            <span>여백 선</span>
          </button>

          <div
            className="flex items-center rounded border p-0.5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => stepZoom(-0.1)}
              title="축소"
              className="cursor-pointer rounded p-1 hover:bg-black/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ZoomOut size={13} />
            </button>
            <span className="w-11 text-center font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => stepZoom(0.1)}
              title="확대"
              className="cursor-pointer rounded p-1 hover:bg-black/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ZoomIn size={13} />
            </button>
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            {[
              { label: '맞춤', value: 'fit' as const },
              { label: '75%', value: 0.75 },
              { label: '100%', value: 1 },
            ].map((item) => {
              const active = zoomMode === item.value;
              return (
                <button
                  key={String(item.value)}
                  type="button"
                  onClick={() => setZoomMode(item.value)}
                  className="cursor-pointer rounded border px-2 py-1 text-[11px]"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-surface)',
                    borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onPrint}
            disabled={isExporting}
            className="ml-1 flex cursor-pointer items-center gap-1 rounded border px-2.5 py-1 font-medium hover:opacity-85 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            <Printer size={13} />
            <span>인쇄</span>
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={isExporting}
            className="flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 font-medium hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <FileDown size={13} />
            <span>PDF 저장</span>
          </button>
        </div>
      </div>

      {/* Desk Area */}
      <div
        ref={deskRef}
        className="print-desk min-h-0 flex-1 overflow-auto px-6 py-8"
      >
        <div className="mx-auto flex flex-col items-center gap-7">
          {pages.map((pageHtml, index) => {
            const scaledWidth = metrics.pageWidthPx * zoomScale;
            const scaledHeight = metrics.pageHeightPx * zoomScale;

            return (
              <div
                key={index}
                style={{
                  width: `${scaledWidth}px`,
                  height: `${scaledHeight}px`,
                }}
              >
                <div
                  className="print-sheet"
                  style={{
                    width: `${metrics.pageWidthPx}px`,
                    height: `${metrics.pageHeightPx}px`,
                    transform: `scale(${zoomScale})`,
                    transformOrigin: 'top left',
                    paddingTop: `${topMarginPx}px`,
                    paddingRight: `${rightMarginPx}px`,
                    paddingBottom: `${bottomMarginPx}px`,
                    paddingLeft: `${leftMarginPx}px`,
                  }}
                >
                  {showMargins && (
                    <div
                      className="print-margin-guide"
                      style={{
                        top: `${topMarginPx}px`,
                        right: `${rightMarginPx}px`,
                        bottom: `${bottomMarginPx}px`,
                        left: `${leftMarginPx}px`,
                      }}
                    />
                  )}

                  {printSettings.showHeader && (
                    <div
                      className="print-sheet-header"
                      style={{
                        height: `${topMarginPx}px`,
                        paddingLeft: `${leftMarginPx}px`,
                        paddingRight: `${rightMarginPx}px`,
                      }}
                    >
                      <span className="truncate">{headerResolved}</span>
                    </div>
                  )}

                  <div
                    className={`md-doc theme-${docTheme}`}
                    style={
                      {
                        width: `${metrics.contentWidthPx}px`,
                        height: `${metrics.contentHeightPx}px`,
                        overflow: 'hidden',
                        '--doc-font-size': `${printSettings.fontSize}px`,
                        '--doc-line-height': String(printSettings.lineHeight),
                      } as React.CSSProperties
                    }
                    dangerouslySetInnerHTML={{ __html: pageHtml }}
                  />

                  {printSettings.showFooter && (
                    <div
                      className="print-sheet-footer"
                      style={{
                        height: `${bottomMarginPx}px`,
                        paddingLeft: `${leftMarginPx}px`,
                        paddingRight: `${rightMarginPx}px`,
                      }}
                    >
                      <span>{formatPageNumber(index, pages.length, printSettings.footerFormat)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
