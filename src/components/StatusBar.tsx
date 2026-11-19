import { CheckCircle2, CircleDot, FolderOpen } from 'lucide-react';
import { DOCUMENT_THEME_LABELS } from './SettingsDrawer';
import type { DocumentTheme, PrintSettings } from '../types/print';

interface StatusBarProps {
  filePath: string | null;
  fileName: string;
  isDirty: boolean;
  wordCount: number;
  charCount: number;
  readingMinutes: number;
  docTheme: DocumentTheme;
  printSettings: PrintSettings;
  onRevealInFolder: (filePath: string) => void;
}

export function StatusBar({
  filePath,
  fileName,
  isDirty,
  wordCount,
  charCount,
  readingMinutes,
  docTheme,
  printSettings,
  onRevealInFolder,
}: StatusBarProps) {
  return (
    <footer
      className="no-print flex h-6 shrink-0 items-center justify-between border-t px-3 text-[11px] select-none"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-secondary)',
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex items-center gap-1 font-medium">
          {isDirty ? (
            <>
              <CircleDot size={11} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--accent)' }}>수정됨</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={11} className="opacity-70" />
              <span>저장됨</span>
            </>
          )}
        </span>

        {filePath ? (
          <button
            type="button"
            onClick={() => onRevealInFolder(filePath)}
            title="Finder에서 파일 위치 보기"
            className="flex min-w-0 cursor-pointer items-center gap-1 truncate hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <FolderOpen size={11} className="shrink-0" />
            <span className="truncate">{filePath}</span>
          </button>
        ) : (
          <span className="truncate" style={{ color: 'var(--text-muted)' }}>
            {fileName} (로컬에 저장되지 않음)
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span>단어 {wordCount.toLocaleString()}</span>
        <span>글자 {charCount.toLocaleString()}</span>
        <span>약 {readingMinutes}분</span>
        <span className="opacity-40">|</span>
        <span>
          {printSettings.paperSize} · {printSettings.orientation === 'portrait' ? '세로' : '가로'}
        </span>
        <span>테마: {DOCUMENT_THEME_LABELS[docTheme]}</span>
      </div>
    </footer>
  );
}
