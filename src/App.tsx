import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { EditorToolbar, type ToolbarAction } from './components/EditorToolbar';
import { MarkdownEditor, type MarkdownEditorHandle } from './components/MarkdownEditor';
import { MarkdownPreview, type MarkdownPreviewHandle } from './components/MarkdownPreview';
import { PrintPreview, type PrintPreviewHandle } from './components/PrintPreview';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { TitleBar } from './components/TitleBar';
import { buildDocumentHtmlFragment, resolveDocumentTitle } from './lib/documentHtml';
import { renderMarkdown } from './lib/markdown';
import { useAppStore } from './store/useAppStore';
import type { TocItem } from './types/document';
import type { MenuAction } from './types/electron';

function getDirname(filePath: string | null): string | null {
  if (!filePath) return null;
  const normalized = filePath.replaceAll('\\', '/');
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return null;
  return filePath.slice(0, idx);
}

export function App() {
  const store = useAppStore();
  const { activeTab } = store;

  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const printPreviewRef = useRef<PrintPreviewHandle | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncSourceRef = useRef<'editor' | 'preview' | null>(null);

  const [splitRatio, setSplitRatio] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);

  const rendered = useMemo(
    () =>
      renderMarkdown(activeTab.content, {
        filePath: activeTab.filePath,
        hrAsPageBreak: store.printSettings.hrAsPageBreak,
      }),
    [activeTab.content, activeTab.filePath, store.printSettings.hrAsPageBreak],
  );

  const docTitle = useMemo(
    () => resolveDocumentTitle(rendered, activeTab.name),
    [rendered, activeTab.name],
  );

  const handlePrint = useCallback(async () => {
    if (!window.electronAPI) {
      window.print();
      return;
    }
    store.setIsExporting(true);
    try {
      const html = buildDocumentHtmlFragment(rendered);
      const result = await window.electronAPI.printDocument({
        title: docTitle,
        html,
        docTheme: store.docTheme,
        settings: store.printSettings,
      });
      if (!result.ok && result.error) {
        store.showToast(result.error, 'error');
      }
    } finally {
      store.setIsExporting(false);
    }
  }, [docTitle, rendered, store]);

  const handleExportPdf = useCallback(async () => {
    if (!window.electronAPI) {
      window.print();
      return;
    }
    store.setIsExporting(true);
    try {
      const html = buildDocumentHtmlFragment(rendered);
      const result = await window.electronAPI.exportPdf({
        title: docTitle,
        html,
        docTheme: store.docTheme,
        settings: store.printSettings,
      });
      if (result.ok && result.filePath) {
        store.showToast(`PDF 저장 완료: ${result.filePath}`, 'success');
      } else if (!result.canceled && result.error) {
        store.showToast(result.error, 'error');
      }
    } finally {
      store.setIsExporting(false);
    }
  }, [docTitle, rendered, store]);

  // Menu actions & OS open-file listener
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const handleMenuAction = (action: MenuAction) => {
      switch (action) {
        case 'new-file':
          store.newTab();
          break;
        case 'open-file':
          void store.openFiles();
          break;
        case 'open-folder':
          void store.openFolder();
          break;
        case 'save':
          void store.saveActiveTab();
          break;
        case 'save-as':
          void store.saveActiveTabAs();
          break;
        case 'close-tab':
          store.closeTab(store.activeTabId);
          break;
        case 'print':
          void handlePrint();
          break;
        case 'export-pdf':
          void handleExportPdf();
          break;
        case 'view-editor':
          store.setViewMode('editor');
          break;
        case 'view-split':
          store.setViewMode('split');
          break;
        case 'view-preview':
          store.setViewMode('preview');
          break;
        case 'view-print-preview':
          store.setViewMode('print-preview');
          break;
        case 'toggle-sidebar':
          store.setSidebarOpen((prev) => !prev);
          break;
        case 'toggle-settings':
          store.setSettingsOpen((prev) => !prev);
          break;
        case 'toggle-ui-theme':
          store.toggleUiTheme();
          break;
      }
    };

    const unsubMenu = api.onMenuAction(handleMenuAction);
    const unsubOpen = api.onOpenFileFromOS((filePath) => {
      void store.openFileByPath(filePath);
    });

    return () => {
      unsubMenu();
      unsubOpen();
    };
  }, [store, handlePrint, handleExportPdf]);

  // Split divider drag handlers
  useEffect(() => {
    if (!isDraggingSplit) return;

    const handleMove = (e: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const next = (e.clientX - rect.left) / rect.width;
      setSplitRatio(Math.min(0.75, Math.max(0.25, next)));
    };

    const handleUp = () => setIsDraggingSplit(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingSplit]);

  const handleToolbarAction = async (action: ToolbarAction) => {
    if (action === 'image') {
      if (window.electronAPI) {
        const picked = await window.electronAPI.pickImageDialog(getDirname(activeTab.filePath));
        if (picked) {
          editorRef.current?.insertText(`![이미지 설명](${picked})`);
        }
      } else {
        editorRef.current?.insertText('![이미지 설명](https://example.com/image.png)');
      }
      return;
    }
    editorRef.current?.applyFormat(action);
  };

  const handleSelectHeading = (item: TocItem) => {
    if (store.viewMode === 'editor') {
      editorRef.current?.scrollToLine(item.line);
      return;
    }
    if (store.viewMode === 'split') {
      editorRef.current?.scrollToLine(item.line);
      previewRef.current?.scrollToHeading(item.id);
      return;
    }
    if (store.viewMode === 'preview') {
      previewRef.current?.scrollToHeading(item.id);
      return;
    }
    if (store.viewMode === 'print-preview') {
      printPreviewRef.current?.scrollToHeading(item.id);
    }
  };

  const handleEditorScrollRatio = useCallback((ratio: number) => {
    if (scrollSyncSourceRef.current === 'preview') return;
    scrollSyncSourceRef.current = 'editor';
    previewRef.current?.setScrollRatio(ratio);
    requestAnimationFrame(() => {
      if (scrollSyncSourceRef.current === 'editor') {
        scrollSyncSourceRef.current = null;
      }
    });
  }, []);

  const handlePreviewScrollRatio = useCallback((ratio: number) => {
    if (scrollSyncSourceRef.current === 'editor') return;
    scrollSyncSourceRef.current = 'preview';
    editorRef.current?.setScrollRatio(ratio);
    requestAnimationFrame(() => {
      if (scrollSyncSourceRef.current === 'preview') {
        scrollSyncSourceRef.current = null;
      }
    });
  }, []);

  // Drag & Drop support for local markdown files
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (!/\.(md|markdown|mdx|txt)$/i.test(file.name)) continue;

      if (window.electronAPI) {
        const resolvedPath = window.electronAPI.getPathForFile(file);
        if (resolvedPath) {
          await store.openFileByPath(resolvedPath);
          continue;
        }
      }
      const text = await file.text();
      store.updateActiveContent(text);
    }
  };

  const showEditor = store.viewMode === 'editor' || store.viewMode === 'split';
  const showPreview = store.viewMode === 'preview' || store.viewMode === 'split';
  const showPrintPreview = store.viewMode === 'print-preview';

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <TitleBar
        platform={window.electronAPI?.platform ?? 'darwin'}
        tabs={store.tabs}
        activeTabId={store.activeTabId}
        sidebarOpen={store.sidebarOpen}
        settingsOpen={store.settingsOpen}
        viewMode={store.viewMode}
        uiTheme={store.uiTheme}
        isExporting={store.isExporting}
        onSelectTab={store.setActiveTabId}
        onCloseTab={store.closeTab}
        onNewTab={store.newTab}
        onToggleSidebar={() => store.setSidebarOpen((prev) => !prev)}
        onToggleSettings={() => store.setSettingsOpen((prev) => !prev)}
        onChangeViewMode={store.setViewMode}
        onToggleUiTheme={store.toggleUiTheme}
        onPrint={() => void handlePrint()}
        onExportPdf={() => void handleExportPdf()}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {store.sidebarOpen && (
          <Sidebar
            activeTab={store.sidebarTab}
            onChangeSidebarTab={store.setSidebarTab}
            folderPath={store.folderPath}
            folderTree={store.folderTree}
            recentFiles={store.recentFiles}
            activeFilePath={activeTab.filePath}
            toc={rendered.toc}
            onOpenFileDialog={() => void store.openFiles()}
            onOpenFolderDialog={() => void store.openFolder()}
            onRefreshFolder={() => void store.refreshFolder()}
            onCreateFileInFolder={store.createFileInOpenedFolder}
            onOpenFilePath={(p) => void store.openFileByPath(p)}
            onClearRecentFiles={store.clearRecentFiles}
            onSelectHeading={handleSelectHeading}
          />
        )}

        <main ref={splitContainerRef} className="flex min-w-0 flex-1 overflow-hidden">
          {showPrintPreview ? (
            <PrintPreview
              ref={printPreviewRef}
              rendered={rendered}
              title={docTitle}
              docTheme={store.docTheme}
              printSettings={store.printSettings}
              isExporting={store.isExporting}
              onPrint={() => void handlePrint()}
              onExportPdf={() => void handleExportPdf()}
            />
          ) : (
            <>
              {showEditor && (
                <section
                  className="flex min-w-0 flex-col overflow-hidden"
                  style={{
                    width: showPreview ? `${splitRatio * 100}%` : '100%',
                  }}
                >
                  <EditorToolbar onAction={(action) => void handleToolbarAction(action)} />
                  <div className="min-h-0 flex-1">
                    <MarkdownEditor
                      ref={editorRef}
                      tabId={activeTab.id}
                      value={activeTab.content}
                      uiTheme={store.uiTheme}
                      onChange={store.updateActiveContent}
                      onScrollRatio={showPreview ? handleEditorScrollRatio : undefined}
                    />
                  </div>
                </section>
              )}

              {showEditor && showPreview && (
                <div
                  onMouseDown={() => setIsDraggingSplit(true)}
                  className="w-1 shrink-0 cursor-col-resize transition-colors hover:bg-[var(--accent)]"
                  style={{
                    backgroundColor: isDraggingSplit ? 'var(--accent)' : 'var(--border-subtle)',
                  }}
                  title="드래그하여 편집/미리보기 비율 조절"
                />
              )}

              {showPreview && (
                <section
                  className="min-w-0 flex-1 overflow-hidden"
                  style={{
                    width: showEditor ? `${(1 - splitRatio) * 100}%` : '100%',
                  }}
                >
                  <MarkdownPreview
                    ref={previewRef}
                    rendered={rendered}
                    docTheme={store.docTheme}
                    uiTheme={store.uiTheme}
                    fontSize={store.printSettings.fontSize}
                    lineHeight={store.printSettings.lineHeight}
                    onToggleTask={store.toggleTaskAtLine}
                    onScrollRatio={showEditor ? handlePreviewScrollRatio : undefined}
                  />
                </section>
              )}
            </>
          )}
        </main>

        {store.settingsOpen && (
          <SettingsDrawer
            docTheme={store.docTheme}
            printSettings={store.printSettings}
            isExporting={store.isExporting}
            onChangeDocTheme={store.setDocTheme}
            onChangePrintSettings={store.setPrintSettings}
            onResetDefaults={store.resetPrintSettings}
            onClose={() => store.setSettingsOpen(false)}
            onPrint={() => void handlePrint()}
            onExportPdf={() => void handleExportPdf()}
          />
        )}
      </div>

      <StatusBar
        filePath={activeTab.filePath}
        fileName={activeTab.name}
        isDirty={activeTab.isDirty}
        wordCount={rendered.wordCount}
        charCount={rendered.charCount}
        readingMinutes={rendered.readingMinutes}
        docTheme={store.docTheme}
        printSettings={store.printSettings}
        onRevealInFolder={(p) => void window.electronAPI?.showItemInFolder(p)}
      />

      {/* Toast Notification */}
      {store.toast && (
        <div
          className="no-print pointer-events-none fixed right-4 bottom-9 z-50 max-w-md rounded-lg border px-3.5 py-2 text-xs font-medium shadow-lg"
          style={{
            backgroundColor:
              store.toast.type === 'error'
                ? '#fef2f2'
                : store.toast.type === 'success'
                  ? '#f0fdf4'
                  : 'var(--bg-elevated)',
            borderColor:
              store.toast.type === 'error'
                ? '#fecaca'
                : store.toast.type === 'success'
                  ? '#bbf7d0'
                  : 'var(--border-strong)',
            color:
              store.toast.type === 'error'
                ? '#b91c1c'
                : store.toast.type === 'success'
                  ? '#15803d'
                  : 'var(--text-primary)',
          }}
        >
          {store.toast.message}
        </div>
      )}

      {/* Drag & Drop File Overlay */}
      {isDraggingFile && (
        <div className="no-print pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div
            className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-10 py-8 shadow-2xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent)',
              color: 'var(--text-primary)',
            }}
          >
            <FileUp size={34} style={{ color: 'var(--accent)' }} />
            <p className="text-sm font-semibold">마크다운 파일을 놓아 열기</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              .md, .markdown, .mdx, .txt 지원
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
