import {
  Columns2,
  Eye,
  FileDown,
  FileText,
  Moon,
  PanelLeft,
  Pencil,
  Plus,
  Printer,
  ScrollText,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import appIcon from '../../assets/icon.png';
import type { OpenTab, UiTheme, ViewMode } from '../types/document';

interface TitleBarProps {
  platform: string;
  tabs: OpenTab[];
  activeTabId: string;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  viewMode: ViewMode;
  uiTheme: UiTheme;
  isExporting: boolean;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onToggleSidebar: () => void;
  onToggleSettings: () => void;
  onChangeViewMode: (mode: ViewMode) => void;
  onToggleUiTheme: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
}

const VIEW_MODES: Array<{ mode: ViewMode; label: string; icon: typeof Pencil; shortcut: string }> = [
  { mode: 'editor', label: '편집', icon: Pencil, shortcut: '⌘1' },
  { mode: 'split', label: '분할', icon: Columns2, shortcut: '⌘2' },
  { mode: 'preview', label: '미리보기', icon: Eye, shortcut: '⌘3' },
  { mode: 'print-preview', label: '인쇄 뷰', icon: ScrollText, shortcut: '⌘4' },
];

export function TitleBar({
  platform,
  tabs,
  activeTabId,
  sidebarOpen,
  settingsOpen,
  viewMode,
  uiTheme,
  isExporting,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onToggleSidebar,
  onToggleSettings,
  onChangeViewMode,
  onToggleUiTheme,
  onPrint,
  onExportPdf,
}: TitleBarProps) {
  const isMac = platform === 'darwin';

  return (
    <header
      className="no-print shrink-0 select-none"
      style={{ backgroundColor: 'var(--bg-sidebar)' }}
    >
      {/* Row 1: 100%-draggable window titlebar with brand name & subtitle */}
      <div
        className="app-drag flex h-9 items-center justify-center gap-2 border-b"
        style={{
          borderColor: 'var(--border-subtle)',
          paddingLeft: isMac ? '78px' : '12px',
          paddingRight: isMac ? '78px' : '12px',
        }}
      >
        <img
          src={appIcon}
          alt="먹(Meok)"
          draggable={false}
          className="pointer-events-none h-4 w-4 rounded-sm object-contain"
        />
        <span className="text-xs font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          먹(Meok)
        </span>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          마크다운(MD) 에디터
        </span>
      </div>

      {/* Row 2: Tabs & Actions (empty areas remain draggable) */}
      <div
        className="app-drag flex h-10 items-center gap-2 border-b px-2.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {/* Sidebar toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          title="사이드바 토글 (⌘\)"
          className="app-no-drag flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
          style={{
            backgroundColor: sidebarOpen ? 'var(--accent-soft)' : 'transparent',
            color: sidebarOpen ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          <PanelLeft size={16} />
        </button>

        {/* Tabs strip (sized to content so empty space to the right stays draggable) */}
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto py-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                title={tab.filePath ?? tab.name}
                className="app-no-drag group flex h-7 max-w-[180px] shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                  borderColor: isActive ? 'var(--border-strong)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <FileText size={13} className="shrink-0 opacity-70" />
                <span className="truncate font-medium">{tab.name}</span>
                {tab.isDirty && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                    title="저장되지 않은 변경 사항"
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  title="탭 닫기 (⌘W)"
                  className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onNewTab}
            title="새 문서 (⌘N)"
            className="app-no-drag flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Plus size={15} />
          </button>
        </div>

        {/* Dedicated flexible drag handle between tabs and right controls */}
        <div className="app-drag h-full min-w-[24px] flex-1" />

        {/* View Mode Switcher */}
        <div
          className="app-no-drag flex shrink-0 items-center rounded-lg border p-0.5"
          style={{
            backgroundColor: 'var(--bg-app)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {VIEW_MODES.map(({ mode, label, icon: Icon, shortcut }) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onChangeViewMode(mode)}
                title={`${label} (${shortcut})`}
                className="flex h-6 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <Icon size={13} />
                <span className="hidden lg:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Action Buttons */}
        <div className="app-no-drag flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleUiTheme}
            title={uiTheme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            {uiTheme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          <button
            type="button"
            onClick={onPrint}
            disabled={isExporting}
            title="인쇄 (⌘P)"
            className="flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-50"
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
            title="PDF로 내보내기 (⌘⇧E)"
            className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <FileDown size={13} />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={onToggleSettings}
            title="인쇄 및 스타일 설정"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border transition-colors"
            style={{
              backgroundColor: settingsOpen ? 'var(--accent-soft)' : 'var(--bg-surface)',
              borderColor: settingsOpen ? 'var(--accent)' : 'var(--border-subtle)',
              color: settingsOpen ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
