import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  ListTree,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { FileTreeNode, TocItem } from '../types/document';

interface SidebarProps {
  activeTab: 'files' | 'toc';
  onChangeSidebarTab: (tab: 'files' | 'toc') => void;
  folderPath: string | null;
  folderTree: FileTreeNode[];
  recentFiles: string[];
  activeFilePath: string | null;
  toc: TocItem[];
  onOpenFileDialog: () => void;
  onOpenFolderDialog: () => void;
  onRefreshFolder: () => void;
  onCreateFileInFolder: (name: string) => Promise<boolean>;
  onOpenFilePath: (filePath: string) => void;
  onClearRecentFiles: () => void;
  onSelectHeading: (item: TocItem) => void;
}

function getBasename(p: string): string {
  const normalized = p.replaceAll('\\', '/');
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? normalized : normalized.slice(idx + 1);
}

function getCompactDir(p: string): string {
  const normalized = p.replaceAll('\\', '/');
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return '';
  const dir = normalized.slice(0, idx);
  const parts = dir.split('/').filter(Boolean);
  if (parts.length <= 2) return dir;
  return `…/${parts.slice(-2).join('/')}`;
}

interface TreeItemProps {
  node: FileTreeNode;
  depth: number;
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
}

function TreeNodeItem({ node, depth, activeFilePath, onSelectFile }: TreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isActive = !node.isDirectory && node.path === activeFilePath;

  if (node.isDirectory) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs transition-colors hover:bg-black/5"
          style={{
            paddingLeft: `${8 + depth * 12}px`,
            color: 'var(--text-primary)',
          }}
        >
          {expanded ? (
            <ChevronDown size={13} className="shrink-0 opacity-60" />
          ) : (
            <ChevronRight size={13} className="shrink-0 opacity-60" />
          )}
          <Folder size={13} className="shrink-0 opacity-75" style={{ color: 'var(--accent)' }} />
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFilePath={activeFilePath}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.path)}
      title={node.path}
      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs transition-colors"
      style={{
        paddingLeft: `${22 + depth * 12}px`,
        backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
        fontWeight: isActive ? 600 : 400,
      }}
    >
      <FileText size={13} className="shrink-0 opacity-75" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function Sidebar({
  activeTab,
  onChangeSidebarTab,
  folderPath,
  folderTree,
  recentFiles,
  activeFilePath,
  toc,
  onOpenFileDialog,
  onOpenFolderDialog,
  onRefreshFolder,
  onCreateFileInFolder,
  onOpenFilePath,
  onClearRecentFiles,
  onSelectHeading,
}: SidebarProps) {
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const ok = await onCreateFileInFolder(newFileName.trim());
    if (ok) {
      setNewFileName('');
      setCreatingFile(false);
    }
  };

  return (
    <aside
      className="no-print flex h-full w-60 shrink-0 flex-col border-r select-none"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Tab switcher */}
      <div
        className="flex gap-1 border-b p-2"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <button
          type="button"
          onClick={() => onChangeSidebarTab('files')}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors"
          style={{
            backgroundColor: activeTab === 'files' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'files' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'files' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <FolderOpen size={13} />
          <span>파일</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeSidebarTab('toc')}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors"
          style={{
            backgroundColor: activeTab === 'toc' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'toc' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'toc' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <ListTree size={13} />
          <span>목차 ({toc.length})</span>
        </button>
      </div>

      {activeTab === 'files' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          {/* Action buttons */}
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onOpenFileDialog}
              className="flex cursor-pointer items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-medium transition-colors hover:opacity-85"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <FileText size={13} />
              <span>파일 열기</span>
            </button>
            <button
              type="button"
              onClick={onOpenFolderDialog}
              className="flex cursor-pointer items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-medium transition-colors hover:opacity-85"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <FolderOpen size={13} />
              <span>폴더 열기</span>
            </button>
          </div>

          {/* Opened Folder Tree */}
          {folderPath && (
            <section className="mb-4">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span
                  className="truncate text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                  title={folderPath}
                >
                  {getBasename(folderPath)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCreatingFile((prev) => !prev)}
                    title="폴더에 새 마크다운 파일 만들기"
                    className="cursor-pointer rounded p-1 hover:bg-black/5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <FilePlus size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={onRefreshFolder}
                    title="폴더 새로 고침"
                    className="cursor-pointer rounded p-1 hover:bg-black/5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>

              {creatingFile && (
                <form onSubmit={handleCreateSubmit} className="mb-2 px-1">
                  <input
                    type="text"
                    autoFocus
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="예: 회의록.md"
                    className="w-full rounded border px-2 py-1 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--accent)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </form>
              )}

              {folderTree.length > 0 ? (
                <div className="space-y-0.5">
                  {folderTree.map((node) => (
                    <TreeNodeItem
                      key={node.path}
                      node={node}
                      depth={0}
                      activeFilePath={activeFilePath}
                      onSelectFile={onOpenFilePath}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-2 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  마크다운 파일이 없습니다.
                </p>
              )}
            </section>
          )}

          {/* Recent files */}
          <section className="mt-1">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span
                className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                <Clock size={11} />
                최근 파일
              </span>
              {recentFiles.length > 0 && (
                <button
                  type="button"
                  onClick={onClearRecentFiles}
                  title="최근 파일 목록 비우기"
                  className="cursor-pointer rounded p-1 hover:bg-black/5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>

            {recentFiles.length > 0 ? (
              <div className="space-y-0.5">
                {recentFiles.map((filePath) => {
                  const isActive = filePath === activeFilePath;
                  return (
                    <button
                      key={filePath}
                      type="button"
                      onClick={() => onOpenFilePath(filePath)}
                      title={filePath}
                      className="flex w-full cursor-pointer flex-col rounded-md px-2 py-1.5 text-left transition-colors hover:bg-black/5"
                      style={{
                        backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                      }}
                    >
                      <span
                        className="truncate text-xs font-medium"
                        style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}
                      >
                        {getBasename(filePath)}
                      </span>
                      <span className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {getCompactDir(filePath)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="px-2 py-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                최근에 연 문서가 여기에 표시됩니다. 파일을 창으로 끌어다 놓아도 바로 열립니다.
              </p>
            )}
          </section>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {toc.length > 0 ? (
            <nav className="space-y-0.5">
              {toc.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectHeading(item)}
                  className="flex w-full cursor-pointer items-center rounded-md py-1.5 pr-2 text-left text-xs transition-colors hover:bg-black/5"
                  style={{
                    paddingLeft: `${8 + (item.level - 1) * 12}px`,
                    color: item.level <= 2 ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: item.level === 1 ? 600 : item.level === 2 ? 500 : 400,
                  }}
                >
                  <span className="truncate">{item.text}</span>
                </button>
              ))}
            </nav>
          ) : (
            <div className="px-3 py-6 text-center text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              문서에 제목(<code>#</code>, <code>##</code>)을 추가하면 목차가 자동으로 생성됩니다.
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
