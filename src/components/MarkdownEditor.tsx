import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { drawSelection, EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view';
import type { UiTheme } from '../types/document';
import type { ToolbarAction } from './EditorToolbar';

export interface MarkdownEditorHandle {
  applyFormat: (action: ToolbarAction) => void;
  insertText: (text: string) => void;
  scrollToLine: (line: number) => void;
  setScrollRatio: (ratio: number) => void;
  focus: () => void;
}

interface MarkdownEditorProps {
  tabId: string;
  value: string;
  uiTheme: UiTheme;
  onChange: (value: string) => void;
  onScrollRatio?: (ratio: number) => void;
}

function createEditorTheme(uiTheme: UiTheme) {
  const isDark = uiTheme === 'dark';

  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: isDark ? '#131c2e' : '#ffffff',
        color: isDark ? '#e2e8f0' : '#0f172a',
        fontSize: '14px',
      },
      '.cm-scroller': {
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Apple SD Gothic Neo", "Malgun Gothic", monospace',
        lineHeight: '1.65',
        padding: '16px 0',
      },
      '.cm-content': {
        padding: '0 20px',
        caretColor: isDark ? '#60a5fa' : '#2563eb',
      },
      '.cm-gutters': {
        backgroundColor: isDark ? '#131c2e' : '#ffffff',
        color: isDark ? '#475569' : '#94a3b8',
        borderRight: 'none',
        paddingLeft: '8px',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.28)' : 'rgba(37, 99, 235, 0.18)',
      },
      '.cm-cursor': {
        borderLeftColor: isDark ? '#60a5fa' : '#2563eb',
        borderLeftWidth: '2px',
      },
    },
    { dark: isDark },
  );
}

function buildEditorExtensions(
  themeCompartment: Compartment,
  uiTheme: UiTheme,
  onDocChange: (value: string) => void,
) {
  return [
    lineNumbers(),
    drawSelection(),
    history(),
    search({ top: true }),
    EditorView.lineWrapping,
    placeholder('여기에 마크다운을 입력하세요...'),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    themeCompartment.of(createEditorTheme(uiTheme)),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onDocChange(update.state.doc.toString());
      }
    }),
  ];
}

function wrapInlineSelection(view: EditorView, marker: string, fallbackText: string): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected.length > 0) {
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
      const unwrapped = selected.slice(marker.length, -marker.length);
      view.dispatch({
        changes: { from, to, insert: unwrapped },
        selection: { anchor: from, head: from + unwrapped.length },
      });
    } else {
      view.dispatch({
        changes: { from, to, insert: `${marker}${selected}${marker}` },
        selection: { anchor: from + marker.length, head: to + marker.length },
      });
    }
    return;
  }

  const inserted = `${marker}${fallbackText}${marker}`;
  view.dispatch({
    changes: { from, to, insert: inserted },
    selection: {
      anchor: from + marker.length,
      head: from + marker.length + fallbackText.length,
    },
  });
}

function prefixSelectedLines(view: EditorView, prefix: string): void {
  const { from, to } = view.state.selection.main;
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(to);
  const changes: Array<{ from: number; to: number; insert: string }> = [];

  for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum += 1) {
    const line = view.state.doc.line(lineNum);
    if (line.text.startsWith(prefix)) {
      changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
    } else {
      const stripped = line.text.replace(/^#{1,6}\s+/, '');
      if (prefix.startsWith('#') && stripped !== line.text) {
        changes.push({ from: line.from, to: line.to, insert: `${prefix}${stripped}` });
      } else {
        changes.push({ from: line.from, to: line.from, insert: prefix });
      }
    }
  }

  view.dispatch({ changes });
}

function insertBlockAtCursor(view: EditorView, snippet: string): void {
  const { from, to } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const needsLeadingNewline = line.text.trim().length > 0;
  const finalText = `${needsLeadingNewline ? '\n\n' : ''}${snippet}\n`;
  view.dispatch({
    changes: { from, to, insert: finalText },
    selection: { anchor: from + finalText.length },
  });
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ tabId, value, uiTheme, onChange, onScrollRatio }, ref) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const themeCompartmentRef = useRef(new Compartment());
    const onChangeRef = useRef(onChange);
    const onScrollRatioRef = useRef(onScrollRatio);
    const lastTabIdRef = useRef<string>(tabId);

    onChangeRef.current = onChange;
    onScrollRatioRef.current = onScrollRatio;

    useEffect(() => {
      const container = hostRef.current;
      if (!container) return;

      const themeComp = themeCompartmentRef.current;
      const state = EditorState.create({
        doc: value,
        extensions: buildEditorExtensions(themeComp, uiTheme, (next) => onChangeRef.current(next)),
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      const handleScroll = () => {
        const scroller = view.scrollDOM;
        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        if (maxScroll > 0) {
          onScrollRatioRef.current?.(scroller.scrollTop / maxScroll);
        }
      };

      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });
      viewRef.current = view;

      return () => {
        view.scrollDOM.removeEventListener('scroll', handleScroll);
        view.destroy();
        viewRef.current = null;
      };
      // Initialize once; tab switches and external value syncs are handled below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reconfigure CodeMirror theme when UI theme changes
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: themeCompartmentRef.current.reconfigure(createEditorTheme(uiTheme)),
      });
    }, [uiTheme]);

    // Sync document when active tab changes or external update occurs (e.g. task checkbox click)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      const tabChanged = lastTabIdRef.current !== tabId;
      lastTabIdRef.current = tabId;

      const currentDoc = view.state.doc.toString();
      if (tabChanged) {
        view.setState(
          EditorState.create({
            doc: value,
            extensions: buildEditorExtensions(themeCompartmentRef.current, uiTheme, (next) =>
              onChangeRef.current(next),
            ),
          }),
        );
        return;
      }

      if (currentDoc !== value) {
        const prevAnchor = Math.min(view.state.selection.main.anchor, value.length);
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
          selection: { anchor: prevAnchor },
        });
      }
    }, [tabId, value, uiTheme]);

    useImperativeHandle(
      ref,
      () => ({
        applyFormat(action: ToolbarAction) {
          const view = viewRef.current;
          if (!view) return;
          view.focus();

          switch (action) {
            case 'h1':
              prefixSelectedLines(view, '# ');
              break;
            case 'h2':
              prefixSelectedLines(view, '## ');
              break;
            case 'h3':
              prefixSelectedLines(view, '### ');
              break;
            case 'bold':
              wrapInlineSelection(view, '**', '굵은 텍스트');
              break;
            case 'italic':
              wrapInlineSelection(view, '*', '기울임 텍스트');
              break;
            case 'strike':
              wrapInlineSelection(view, '~~', '취소선 텍스트');
              break;
            case 'code':
              wrapInlineSelection(view, '`', 'code');
              break;
            case 'ul':
              prefixSelectedLines(view, '- ');
              break;
            case 'ol':
              prefixSelectedLines(view, '1. ');
              break;
            case 'task':
              prefixSelectedLines(view, '- [ ] ');
              break;
            case 'quote':
              prefixSelectedLines(view, '> ');
              break;
            case 'link': {
              const { from, to } = view.state.selection.main;
              const selected = view.state.sliceDoc(from, to) || '링크 제목';
              const inserted = `[${selected}](https://example.com)`;
              view.dispatch({
                changes: { from, to, insert: inserted },
                selection: {
                  anchor: from + selected.length + 3,
                  head: from + inserted.length - 1,
                },
              });
              break;
            }
            case 'table':
              insertBlockAtCursor(
                view,
                '| 항목 | 내용 | 비고 |\n| :--- | :--- | :--- |\n| 예시 1 | 설명 | - |\n| 예시 2 | 설명 | - |',
              );
              break;
            case 'codeblock':
              insertBlockAtCursor(view, '```typescript\nconsole.log("Hello Meok");\n```');
              break;
            case 'math':
              insertBlockAtCursor(view, '$$\nE = mc^2\n$$');
              break;
            case 'mermaid':
              insertBlockAtCursor(view, '```mermaid\nflowchart LR\n  A[시작] --> B[완료]\n```');
              break;
            case 'pagebreak':
              insertBlockAtCursor(view, '<!-- pagebreak -->');
              break;
            default:
              break;
          }
        },
        insertText(text: string) {
          const view = viewRef.current;
          if (!view) return;
          view.focus();
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
          });
        },
        scrollToLine(lineNumber: number) {
          const view = viewRef.current;
          if (!view) return;
          const clamped = Math.min(Math.max(1, lineNumber), view.state.doc.lines);
          const line = view.state.doc.line(clamped);
          view.dispatch({
            selection: { anchor: line.from },
            effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 24 }),
          });
        },
        setScrollRatio(ratio: number) {
          const view = viewRef.current;
          if (!view) return;
          const scroller = view.scrollDOM;
          const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          scroller.scrollTop = ratio * maxScroll;
        },
        focus() {
          viewRef.current?.focus();
        },
      }),
      [],
    );

    return <div ref={hostRef} className="h-full w-full overflow-hidden" />;
  },
);
