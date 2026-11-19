import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_DOCUMENT_CONTENT, SAMPLE_DOCUMENT_NAME } from '../lib/sampleDocument';
import type { FileTreeNode, OpenTab, UiTheme, ViewMode } from '../types/document';
import type { AppPersistedState } from '../types/electron';
import { DEFAULT_PRINT_SETTINGS, type DocumentTheme, type PrintSettings } from '../types/print';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
}

function createTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSampleTab(): OpenTab {
  return {
    id: createTabId(),
    filePath: null,
    name: SAMPLE_DOCUMENT_NAME,
    content: SAMPLE_DOCUMENT_CONTENT,
    savedContent: SAMPLE_DOCUMENT_CONTENT,
    isDirty: false,
    isSample: true,
  };
}

function createBlankTab(existingTabs: OpenTab[]): OpenTab {
  const existingNames = new Set(existingTabs.map((t) => t.name));
  let name = '제목 없음.md';
  let index = 2;
  while (existingNames.has(name)) {
    name = `제목 없음-${index}.md`;
    index += 1;
  }
  return {
    id: createTabId(),
    filePath: null,
    name,
    content: '# 새 문서\n\n여기에 마크다운 내용을 작성하세요.\n',
    savedContent: '# 새 문서\n\n여기에 마크다운 내용을 작성하세요.\n',
    isDirty: false,
  };
}

export function useAppStore() {
  const initialTabRef = useRef<OpenTab | null>(null);
  if (!initialTabRef.current) {
    initialTabRef.current = createSampleTab();
  }

  const [tabs, setTabs] = useState<OpenTab[]>([initialTabRef.current]);
  const [activeTabId, setActiveTabId] = useState<string>(initialTabRef.current.id);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderTree, setFolderTree] = useState<FileTreeNode[]>([]);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'toc'>('files');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [uiTheme, setUiTheme] = useState<UiTheme>('light');
  const [docTheme, setDocTheme] = useState<DocumentTheme>('github');
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  const activeTab = useMemo(() => {
    return tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  }, [tabs, activeTabId]);

  // Apply UI theme attribute to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', uiTheme);
  }, [uiTheme]);

  // Load persisted settings on mount
  useEffect(() => {
    let active = true;
    async function hydrate() {
      const api = window.electronAPI;
      if (!api) {
        try {
          const saved = localStorage.getItem('meok-state');
          if (saved) {
            const parsed = JSON.parse(saved) as Partial<AppPersistedState>;
            if (parsed.uiTheme) setUiTheme(parsed.uiTheme);
            if (parsed.docTheme) setDocTheme(parsed.docTheme);
            if (parsed.printSettings) {
              setPrintSettings({
                ...DEFAULT_PRINT_SETTINGS,
                ...parsed.printSettings,
                margins: {
                  ...DEFAULT_PRINT_SETTINGS.margins,
                  ...(parsed.printSettings.margins ?? {}),
                },
              });
            }
          }
        } catch {
          // ignore localStorage errors
        }
        if (active) setHydrated(true);
        return;
      }

      try {
        const state = await api.loadAppState();
        if (!active) return;
        setRecentFiles(state.recentFiles);
        setUiTheme(state.uiTheme);
        setDocTheme(state.docTheme);
        setPrintSettings(state.printSettings);
        if (state.lastFolderPath) {
          const tree = await api.readDirectoryTree(state.lastFolderPath);
          if (!active) return;
          setFolderPath(state.lastFolderPath);
          setFolderTree(tree);
        }
      } catch {
        // ignore load errors
      } finally {
        if (active) setHydrated(true);
      }
    }
    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  // Persist settings debounced after hydration
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const stateToSave: AppPersistedState = {
        recentFiles,
        lastFolderPath: folderPath,
        uiTheme,
        docTheme,
        printSettings,
      };
      if (window.electronAPI) {
        void window.electronAPI.saveAppState(stateToSave);
      } else {
        try {
          localStorage.setItem('meok-state', JSON.stringify(stateToSave));
        } catch {
          // ignore
        }
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [hydrated, recentFiles, folderPath, uiTheme, docTheme, printSettings]);

  const addToRecentFiles = useCallback((filePath: string) => {
    setRecentFiles((prev) => [filePath, ...prev.filter((item) => item !== filePath)].slice(0, 15));
  }, []);

  const clearRecentFiles = useCallback(() => {
    setRecentFiles([]);
  }, []);

  const openLoadedFile = useCallback(
    (filePath: string, name: string, content: string) => {
      setTabs((prev) => {
        const existing = prev.find((t) => t.filePath === filePath);
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
        const newTab: OpenTab = {
          id: createTabId(),
          filePath,
          name,
          content,
          savedContent: content,
          isDirty: false,
        };
        if (prev.length === 1 && prev[0].isSample && !prev[0].isDirty) {
          setActiveTabId(newTab.id);
          return [newTab];
        }
        setActiveTabId(newTab.id);
        return [...prev, newTab];
      });
      addToRecentFiles(filePath);
    },
    [addToRecentFiles],
  );

  const openFileByPath = useCallback(
    async (filePath: string) => {
      const existing = tabs.find((t) => t.filePath === filePath);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }

      if (!window.electronAPI) {
        showToast('파일 시스템 접근은 Electron 앱에서 지원됩니다.', 'error');
        return;
      }

      const res = await window.electronAPI.readFile(filePath);
      if (!res.ok || res.content === undefined) {
        showToast(res.error ?? '파일을 열 수 없습니다.', 'error');
        return;
      }
      openLoadedFile(res.filePath, res.name, res.content);
    },
    [tabs, openLoadedFile, showToast],
  );

  const openFiles = useCallback(async () => {
    if (!window.electronAPI) {
      // Browser fallback with hidden input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.markdown,.mdx,.txt';
      input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files ?? []);
        for (const file of files) {
          const text = await file.text();
          const newTab: OpenTab = {
            id: createTabId(),
            filePath: null,
            name: file.name,
            content: text,
            savedContent: text,
            isDirty: false,
          };
          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
        }
      };
      input.click();
      return;
    }

    const opened = await window.electronAPI.openFileDialog();
    for (const item of opened) {
      openLoadedFile(item.filePath, item.name, item.content);
    }
  }, [openLoadedFile]);

  const openFolder = useCallback(async () => {
    if (!window.electronAPI) {
      showToast('폴더 열기는 Electron 앱에서 지원됩니다.', 'error');
      return;
    }
    const result = await window.electronAPI.openFolderDialog();
    if (!result) return;
    setFolderPath(result.folderPath);
    setFolderTree(result.tree);
    setSidebarOpen(true);
    setSidebarTab('files');
  }, [showToast]);

  const refreshFolder = useCallback(async () => {
    if (!window.electronAPI || !folderPath) return;
    const tree = await window.electronAPI.readDirectoryTree(folderPath);
    setFolderTree(tree);
  }, [folderPath]);

  const createFileInOpenedFolder = useCallback(
    async (fileName: string): Promise<boolean> => {
      if (!window.electronAPI || !folderPath) return false;
      const res = await window.electronAPI.createFileInFolder(folderPath, fileName);
      if (!res.ok || !res.filePath || !res.name) {
        showToast(res.error ?? '새 파일을 생성하지 못했습니다.', 'error');
        return false;
      }
      await refreshFolder();
      await openFileByPath(res.filePath);
      showToast(`${res.name} 파일이 생성되었습니다.`, 'success');
      return true;
    },
    [folderPath, refreshFolder, openFileByPath, showToast],
  );

  const newTab = useCallback(() => {
    setTabs((prev) => {
      const created = createBlankTab(prev);
      setActiveTabId(created.id);
      return [...prev, created];
    });
    setViewMode((current) => (current === 'preview' || current === 'print-preview' ? 'split' : current));
  }, []);

  const updateActiveContent = useCallback(
    (nextContent: string) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          return {
            ...tab,
            content: nextContent,
            isDirty: nextContent !== tab.savedContent,
          };
        }),
      );
    },
    [activeTabId],
  );

  const toggleTaskAtLine = useCallback(
    (lineNumber: number) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          const lines = tab.content.split('\n');
          const idx = lineNumber - 1;
          if (idx < 0 || idx >= lines.length) return tab;
          const line = lines[idx];
          const updated = line.replace(
            /^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\]\s+.*)$/,
            (_m, prefix: string, state: string, suffix: string) =>
              `${prefix}${state === ' ' ? 'x' : ' '}${suffix}`,
          );
          if (updated === line) return tab;
          lines[idx] = updated;
          const nextContent = lines.join('\n');
          return {
            ...tab,
            content: nextContent,
            isDirty: nextContent !== tab.savedContent,
          };
        }),
      );
    },
    [activeTabId],
  );

  const saveActiveTabAs = useCallback(async (): Promise<boolean> => {
    if (!activeTab) return false;
    if (!window.electronAPI) {
      const blob = new Blob([activeTab.content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeTab.name;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    }

    const res = await window.electronAPI.saveFileAsDialog(activeTab.name, activeTab.content);
    if (res.canceled) return false;
    if (!res.ok || !res.filePath || !res.name) {
      showToast(res.error ?? '저장에 실패했습니다.', 'error');
      return false;
    }

    const savedPath = res.filePath;
    const savedName = res.name;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              filePath: savedPath,
              name: savedName,
              savedContent: tab.content,
              isDirty: false,
              isSample: false,
            }
          : tab,
      ),
    );
    addToRecentFiles(savedPath);
    if (folderPath && savedPath.startsWith(folderPath)) {
      void refreshFolder();
    }
    showToast(`${savedName} 저장 완료`, 'success');
    return true;
  }, [activeTab, addToRecentFiles, folderPath, refreshFolder, showToast]);

  const saveActiveTab = useCallback(async (): Promise<boolean> => {
    if (!activeTab) return false;
    if (!activeTab.filePath) {
      return saveActiveTabAs();
    }
    if (!window.electronAPI) {
      return saveActiveTabAs();
    }
    const res = await window.electronAPI.writeFile(activeTab.filePath, activeTab.content);
    if (!res.ok) {
      showToast(res.error ?? '저장에 실패했습니다.', 'error');
      return false;
    }
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? { ...tab, savedContent: tab.content, isDirty: false, isSample: false }
          : tab,
      ),
    );
    showToast(`${activeTab.name} 저장 완료`, 'success');
    return true;
  }, [activeTab, saveActiveTabAs, showToast]);

  const closeTab = useCallback(
    (tabId: string) => {
      const target = tabs.find((t) => t.id === tabId);
      if (!target) return;
      if (target.isDirty) {
        const confirmed = window.confirm(`"${target.name}" 문서의 변경 사항을 저장하지 않고 닫을까요?`);
        if (!confirmed) return;
      }

      setTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== tabId);
        if (remaining.length === 0) {
          const fresh = createBlankTab([]);
          setActiveTabId(fresh.id);
          return [fresh];
        }
        if (tabId === activeTabId) {
          const closedIdx = prev.findIndex((t) => t.id === tabId);
          const nextTab = remaining[Math.min(closedIdx, remaining.length - 1)];
          setActiveTabId(nextTab.id);
        }
        return remaining;
      });
    },
    [tabs, activeTabId],
  );

  const toggleUiTheme = useCallback(() => {
    setUiTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const resetPrintSettings = useCallback(() => {
    setPrintSettings(DEFAULT_PRINT_SETTINGS);
    showToast('인쇄 설정을 기본값으로 복원했습니다.', 'info');
  }, [showToast]);

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    folderPath,
    folderTree,
    recentFiles,
    sidebarOpen,
    setSidebarOpen,
    sidebarTab,
    setSidebarTab,
    settingsOpen,
    setSettingsOpen,
    viewMode,
    setViewMode,
    uiTheme,
    setUiTheme,
    toggleUiTheme,
    docTheme,
    setDocTheme,
    printSettings,
    setPrintSettings,
    resetPrintSettings,
    isExporting,
    setIsExporting,
    toast,
    showToast,
    newTab,
    openFiles,
    openFileByPath,
    openFolder,
    refreshFolder,
    createFileInOpenedFolder,
    clearRecentFiles,
    updateActiveContent,
    toggleTaskAtLine,
    saveActiveTab,
    saveActiveTabAs,
    closeTab,
  };
}
