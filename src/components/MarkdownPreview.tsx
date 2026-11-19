import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { buildDocumentHtmlFragment } from '../lib/documentHtml';
import type { RenderedMarkdownResult } from '../lib/markdown';
import { hydrateMermaidBlocks } from '../lib/mermaidRenderer';
import type { UiTheme } from '../types/document';
import type { DocumentTheme } from '../types/print';

export interface MarkdownPreviewHandle {
  scrollToHeading: (id: string) => void;
  setScrollRatio: (ratio: number) => void;
}

interface MarkdownPreviewProps {
  rendered: RenderedMarkdownResult;
  docTheme: DocumentTheme;
  uiTheme: UiTheme;
  fontSize: number;
  lineHeight: number;
  onToggleTask: (line: number) => void;
  onScrollRatio?: (ratio: number) => void;
}

export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview(
    { rendered, docTheme, uiTheme, fontSize, lineHeight, onToggleTask, onScrollRatio },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    const documentHtml = useMemo(() => buildDocumentHtmlFragment(rendered), [rendered]);
    const markup = useMemo(() => ({ __html: documentHtml }), [documentHtml]);

    useEffect(() => {
      const container = contentRef.current;
      if (!container) return;
      void hydrateMermaidBlocks(container, uiTheme);
    }, [markup, uiTheme]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToHeading(id: string) {
          const container = contentRef.current;
          if (!container) return;
          const target = Array.from(container.querySelectorAll<HTMLElement>('[id]')).find(
            (el) => el.id === id,
          );
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        setScrollRatio(ratio: number) {
          const scroller = scrollRef.current;
          if (!scroller) return;
          const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          scroller.scrollTop = ratio * maxScroll;
        },
      }),
      [],
    );

    const handleScroll = () => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      if (maxScroll > 0) {
        onScrollRatio?.(scroller.scrollTop / maxScroll);
      }
    };

    const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Task list checkbox toggle
      const checkbox = target.closest<HTMLInputElement>('input.task-list-checkbox');
      if (checkbox) {
        e.preventDefault();
        const lineStr = checkbox.getAttribute('data-source-line');
        const lineNum = lineStr ? Number.parseInt(lineStr, 10) : NaN;
        if (Number.isFinite(lineNum)) {
          onToggleTask(lineNum);
        }
        return;
      }

      // 2. Copy code block button
      const copyBtn = target.closest<HTMLButtonElement>('button[data-copy-code="true"]');
      if (copyBtn) {
        const wrapper = copyBtn.closest('.code-block-wrapper');
        const codeEl = wrapper?.querySelector('pre code');
        if (codeEl?.textContent) {
          try {
            await navigator.clipboard.writeText(codeEl.textContent);
            copyBtn.textContent = '복사됨 ✓';
            window.setTimeout(() => {
              copyBtn.textContent = '복사';
            }, 1500);
          } catch {
            // ignore clipboard errors
          }
        }
        return;
      }

      // 3. Links (internal heading anchors or external URLs)
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (anchor) {
        const href = anchor.getAttribute('href') ?? '';
        if (href.startsWith('#')) {
          e.preventDefault();
          const id = decodeURIComponent(href.slice(1));
          const container = contentRef.current;
          const heading = container
            ? Array.from(container.querySelectorAll<HTMLElement>('[id]')).find((el) => el.id === id)
            : null;
          heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (/^(?:https?:|mailto:)/i.test(href)) {
          e.preventDefault();
          if (window.electronAPI) {
            void window.electronAPI.openExternal(href);
          } else {
            window.open(href, '_blank', 'noopener,noreferrer');
          }
        }
      }
    };

    return (
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto px-6 py-8 sm:px-10"
        style={{ backgroundColor: uiTheme === 'dark' ? '#131c2e' : '#ffffff' }}
      >
        <div
          ref={contentRef}
          onClick={handleClick}
          className={`md-doc theme-${docTheme}${uiTheme === 'dark' ? ' is-dark' : ''} mx-auto max-w-[820px]`}
          style={
            {
              '--doc-font-size': `${fontSize}px`,
              '--doc-line-height': String(lineHeight),
            } as React.CSSProperties
          }
          dangerouslySetInnerHTML={markup}
        />
      </div>
    );
  },
);
