import { useEffect, useRef, useState } from 'react';
import { hydrateMermaidBlocks } from '../lib/mermaidRenderer';
import { getPaperDimensionsMm } from '../lib/paginator';
import type { FooterFormat, PrintPayload } from '../types/print';

function escapeCssContent(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
}

function buildFooterCssContent(format: FooterFormat): string {
  switch (format) {
    case 'dash':
      return `"- " counter(page) " -"`;
    case 'pageOf':
      return `"Page " counter(page) " of " counter(pages)`;
    case 'slash':
    default:
      return `counter(page) " / " counter(pages)`;
  }
}

function buildDynamicPageCss(payload: PrintPayload): string {
  const { settings, title, includeCssPageHeaders } = payload;
  const { widthMm, heightMm } = getPaperDimensionsMm(settings.paperSize, settings.orientation);
  const headerResolved = (settings.headerText || '{{title}}').replaceAll('{{title}}', title);

  const marginBoxes: string[] = [];
  if (includeCssPageHeaders) {
    if (settings.showHeader) {
      marginBoxes.push(`
        @top-center {
          content: "${escapeCssContent(headerResolved)}";
          font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
          font-size: 9pt;
          color: #64748b;
        }
      `);
    }
    if (settings.showFooter) {
      marginBoxes.push(`
        @bottom-center {
          content: ${buildFooterCssContent(settings.footerFormat)};
          font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
          font-size: 9pt;
          color: #64748b;
        }
      `);
    }
  }

  return `
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin: ${settings.margins.top}mm ${settings.margins.right}mm ${settings.margins.bottom}mm ${settings.margins.left}mm;
      ${marginBoxes.join('\n')}
    }
    html, body, #root {
      background: #ffffff !important;
      color: #1e293b !important;
      height: auto !important;
      overflow: visible !important;
    }
  `;
}

async function waitForAllImages(container: HTMLElement): Promise<void> {
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
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]);
}

export function PrintHost() {
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get('jobId') ?? '';

  const [payload, setPayload] = useState<PrintPayload | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!window.electronAPI || !jobId) return;
      const data = await window.electronAPI.getPrintPayload(jobId);
      if (!active) return;
      if (!data) {
        window.electronAPI.notifyPrintError(jobId, '인쇄 데이터를 찾을 수 없습니다.');
        return;
      }
      setPayload(data);
    }
    void load();
    return () => {
      active = false;
    };
  }, [jobId]);

  useEffect(() => {
    if (!payload || !contentRef.current) return;
    let active = true;

    async function prepareAndNotify() {
      try {
        const container = contentRef.current;
        if (!container) return;

        await hydrateMermaidBlocks(container, 'light');
        await document.fonts.ready;
        await waitForAllImages(container);

        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );

        if (active && window.electronAPI) {
          window.electronAPI.notifyPrintReady(jobId);
        }
      } catch (err) {
        if (active && window.electronAPI) {
          window.electronAPI.notifyPrintError(
            jobId,
            err instanceof Error ? err.message : '인쇄 준비 중 오류가 발생했습니다.',
          );
        }
      }
    }

    void prepareAndNotify();
    return () => {
      active = false;
    };
  }, [payload, jobId]);

  if (!payload) {
    return <div className="p-8 text-sm text-slate-500">인쇄 문서를 준비하고 있습니다...</div>;
  }

  return (
    <div className="print-host bg-white">
      <style>{buildDynamicPageCss(payload)}</style>
      <div
        ref={contentRef}
        className={`md-doc theme-${payload.docTheme}`}
        style={
          {
            '--doc-font-size': `${payload.settings.fontSize}px`,
            '--doc-line-height': String(payload.settings.lineHeight),
          } as React.CSSProperties
        }
        dangerouslySetInnerHTML={{ __html: payload.html }}
      />
    </div>
  );
}
