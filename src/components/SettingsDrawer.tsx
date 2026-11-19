import { FileDown, Printer, RotateCcw, X } from 'lucide-react';
import {
  PAPER_DIMENSIONS_MM,
  type DocumentTheme,
  type FooterFormat,
  type Orientation,
  type PaperSize,
  type PrintSettings,
} from '../types/print';

export const DOCUMENT_THEME_LABELS: Record<DocumentTheme, string> = {
  github: 'GitHub',
  report: '보고서 / 논문',
  minimal: '미니멀',
};

const THEME_OPTIONS: Array<{ id: DocumentTheme; title: string; subtitle: string }> = [
  { id: 'github', title: 'GitHub', subtitle: '개발 문서 · README' },
  { id: 'report', title: '보고서', subtitle: '명조 · 격식 있는 표' },
  { id: 'minimal', title: '미니멀', subtitle: '깔끔한 현대적 노트' },
];

interface SettingsDrawerProps {
  docTheme: DocumentTheme;
  printSettings: PrintSettings;
  isExporting: boolean;
  onChangeDocTheme: (theme: DocumentTheme) => void;
  onChangePrintSettings: (next: PrintSettings) => void;
  onResetDefaults: () => void;
  onClose: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
}

export function SettingsDrawer({
  docTheme,
  printSettings,
  isExporting,
  onChangeDocTheme,
  onChangePrintSettings,
  onResetDefaults,
  onClose,
  onPrint,
  onExportPdf,
}: SettingsDrawerProps) {
  const updateMargins = (edge: keyof PrintSettings['margins'], value: number) => {
    const clamped = Number.isFinite(value) ? Math.min(50, Math.max(0, value)) : 0;
    onChangePrintSettings({
      ...printSettings,
      margins: {
        ...printSettings.margins,
        [edge]: clamped,
      },
    });
  };

  const applyMarginPreset = (mm: number) => {
    onChangePrintSettings({
      ...printSettings,
      margins: { top: mm, right: mm, bottom: mm, left: mm },
    });
  };

  return (
    <aside
      className="no-print flex h-full w-[300px] shrink-0 flex-col border-l select-none"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
          인쇄 및 문서 스타일
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded p-1 hover:bg-black/5"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-xs">
        {/* Document Theme */}
        <section className="space-y-2">
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            문서 테마 프리셋
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {THEME_OPTIONS.map((opt) => {
              const active = docTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeDocTheme(opt.id)}
                  className="cursor-pointer rounded-lg border p-2 text-left transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-surface)',
                    borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                  }}
                >
                  <div
                    className="font-semibold"
                    style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}
                  >
                    {opt.title}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                    {opt.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Paper Size & Orientation */}
        <section className="space-y-2.5">
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            용지 및 방향
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                용지 크기
              </label>
              <select
                value={printSettings.paperSize}
                onChange={(e) =>
                  onChangePrintSettings({ ...printSettings, paperSize: e.target.value as PaperSize })
                }
                className="w-full rounded-md border px-2 py-1.5 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                {(Object.keys(PAPER_DIMENSIONS_MM) as PaperSize[]).map((size) => (
                  <option key={size} value={size}>
                    {PAPER_DIMENSIONS_MM[size].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                용지 방향
              </label>
              <div
                className="flex rounded-md border p-0.5"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)',
                }}
              >
                {(['portrait', 'landscape'] as Orientation[]).map((ori) => {
                  const active = printSettings.orientation === ori;
                  return (
                    <button
                      key={ori}
                      type="button"
                      onClick={() => onChangePrintSettings({ ...printSettings, orientation: ori })}
                      className="flex-1 cursor-pointer rounded py-1 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: active ? 'var(--accent)' : 'transparent',
                        color: active ? 'var(--accent-fg)' : 'var(--text-secondary)',
                      }}
                    >
                      {ori === 'portrait' ? '세로' : '가로'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Margins */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              여백 (mm)
            </span>
            <div className="flex gap-1">
              {[
                { label: '좁게', mm: 12 },
                { label: '보통', mm: 20 },
                { label: '넓게', mm: 28 },
              ].map((preset) => (
                <button
                  key={preset.mm}
                  type="button"
                  onClick={() => applyMarginPreset(preset.mm)}
                  className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px] hover:opacity-80"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ['top', '상'],
                ['bottom', '하'],
                ['left', '좌'],
                ['right', '우'],
              ] as Array<[keyof PrintSettings['margins'], string]>
            ).map(([edge, label]) => (
              <label key={edge} className="block">
                <span className="mb-1 block text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={printSettings.margins[edge]}
                  onChange={(e) => updateMargins(edge, Number(e.target.value))}
                  className="w-full rounded border px-1.5 py-1 text-center text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                />
              </label>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-3">
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            글꼴 크기 및 줄 간격
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <span>본문 글꼴 크기</span>
              <span className="font-mono font-medium">{printSettings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={11}
              max={20}
              step={1}
              value={printSettings.fontSize}
              onChange={(e) =>
                onChangePrintSettings({ ...printSettings, fontSize: Number(e.target.value) })
              }
              className="w-full cursor-pointer accent-[var(--accent)]"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <span>줄 간격</span>
              <span className="font-mono font-medium">{printSettings.lineHeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={1.4}
              max={2.0}
              step={0.05}
              value={printSettings.lineHeight}
              onChange={(e) =>
                onChangePrintSettings({ ...printSettings, lineHeight: Number(e.target.value) })
              }
              className="w-full cursor-pointer accent-[var(--accent)]"
            />
          </div>
        </section>

        {/* Header & Footer */}
        <section className="space-y-2.5">
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            머리글 / 페이지 번호
          </div>

          <label className="flex cursor-pointer items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>머리글 표시</span>
            <input
              type="checkbox"
              checked={printSettings.showHeader}
              onChange={(e) =>
                onChangePrintSettings({ ...printSettings, showHeader: e.target.checked })
              }
              className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
            />
          </label>

          {printSettings.showHeader && (
            <div>
              <input
                type="text"
                value={printSettings.headerText}
                onChange={(e) =>
                  onChangePrintSettings({ ...printSettings, headerText: e.target.value })
                }
                placeholder="{{title}}"
                className="w-full rounded-md border px-2.5 py-1.5 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
              <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <code>{'{{title}}'}</code> 입력 시 문서 제목으로 자동 치환됩니다.
              </p>
            </div>
          )}

          <label className="flex cursor-pointer items-center justify-between pt-1">
            <span style={{ color: 'var(--text-secondary)' }}>바닥글 페이지 번호 표시</span>
            <input
              type="checkbox"
              checked={printSettings.showFooter}
              onChange={(e) =>
                onChangePrintSettings({ ...printSettings, showFooter: e.target.checked })
              }
              className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
            />
          </label>

          {printSettings.showFooter && (
            <select
              value={printSettings.footerFormat}
              onChange={(e) =>
                onChangePrintSettings({ ...printSettings, footerFormat: e.target.value as FooterFormat })
              }
              className="w-full rounded-md border px-2 py-1.5 text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="slash">1 / 5 형식</option>
              <option value="dash">- 1 - 형식</option>
              <option value="pageOf">Page 1 of 5 형식</option>
            </select>
          )}
        </section>

        {/* Page Break Options */}
        <section className="space-y-2">
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            페이지 나누기
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span style={{ color: 'var(--text-secondary)' }}>수평선(---)을 페이지 나누기로 사용</span>
            <input
              type="checkbox"
              checked={printSettings.hrAsPageBreak}
              onChange={(e) =>
                onChangePrintSettings({ ...printSettings, hrAsPageBreak: e.target.checked })
              }
              className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
            />
          </label>
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            문서 내 원하는 위치에 <code>&lt;!-- pagebreak --&gt;</code> 를 넣으면 항상 새 페이지에서 시작합니다.
          </p>
        </section>
      </div>

      {/* Footer Actions */}
      <div
        className="space-y-2 border-t p-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrint}
            disabled={isExporting}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors hover:opacity-85 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            <Printer size={14} />
            <span>인쇄하기</span>
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={isExporting}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <FileDown size={14} />
            <span>PDF 저장</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onResetDefaults}
          className="flex w-full cursor-pointer items-center justify-center gap-1 py-1 text-[11px] hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          <RotateCcw size={11} />
          <span>기본 설정으로 복원</span>
        </button>
      </div>
    </aside>
  );
}
