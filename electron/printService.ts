import { BrowserWindow, dialog, ipcMain } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FooterFormat, PaperSize, PrintPayload, PrintSettings } from '../src/types/print';

interface PendingJob {
  payload: PrintPayload;
  resolveReady?: () => void;
  rejectReady?: (error: Error) => void;
}

const pendingJobs = new Map<string, PendingJob>();

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function mmToInches(mm: number): number {
  return Math.max(0, mm) / 25.4;
}

function resolvePdfPageSize(paperSize: PaperSize): Electron.PrintToPDFOptions['pageSize'] {
  if (paperSize === 'A4' || paperSize === 'Letter' || paperSize === 'Legal') {
    return paperSize;
  }
  // ISO B5 in inches (176 x 250 mm)
  return {
    width: mmToInches(176),
    height: mmToInches(250),
  };
}

function resolveWebPrintPageSize(paperSize: PaperSize): Electron.WebContentsPrintOptions['pageSize'] {
  if (paperSize === 'A4' || paperSize === 'Letter' || paperSize === 'Legal') {
    return paperSize;
  }
  // WebContentsPrintOptions Size is specified in microns (176 x 250 mm)
  return {
    width: 176_000,
    height: 250_000,
  };
}

function buildHeaderTemplate(payload: PrintPayload): string {
  const { settings, title } = payload;
  if (!settings.showHeader) {
    return '<span></span>';
  }
  const rawHeader = (settings.headerText || '{{title}}').replaceAll('{{title}}', title);
  return `
    <div style="
      width: 100%;
      font-size: 9px;
      font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      color: #64748b;
      padding: 0 ${settings.margins.right}mm 0 ${settings.margins.left}mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-sizing: border-box;
    ">
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(rawHeader)}</span>
    </div>
  `;
}

function formatFooterSpan(format: FooterFormat): string {
  switch (format) {
    case 'dash':
      return '- <span class="pageNumber"></span> -';
    case 'pageOf':
      return 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>';
    case 'slash':
    default:
      return '<span class="pageNumber"></span> / <span class="totalPages"></span>';
  }
}

function buildFooterTemplate(settings: PrintSettings): string {
  if (!settings.showFooter) {
    return '<span></span>';
  }
  return `
    <div style="
      width: 100%;
      font-size: 9px;
      font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      color: #64748b;
      padding: 0 ${settings.margins.right}mm 0 ${settings.margins.left}mm;
      display: flex;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
    ">
      <span>${formatFooterSpan(settings.footerFormat)}</span>
    </div>
  `;
}

function sanitizePdfFileName(title: string): string {
  const stripped = title
    .replace(/\.(md|markdown|mdx|txt)$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim();
  return `${stripped || 'document'}.pdf`;
}

async function createPrintWindow(payload: PrintPayload): Promise<{ win: BrowserWindow; jobId: string }> {
  const jobId = crypto.randomUUID();

  const win = new BrowserWindow({
    show: false,
    width: 1020,
    height: 1280,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const readyPromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingJobs.delete(jobId);
      reject(new Error('인쇄 문서 렌더링 시간이 초과되었습니다.'));
    }, 15000);

    pendingJobs.set(jobId, {
      payload,
      resolveReady: () => {
        clearTimeout(timer);
        resolve();
      },
      rejectReady: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });

    win.webContents.once('did-fail-load', (_event, _code, description) => {
      clearTimeout(timer);
      pendingJobs.delete(jobId);
      reject(new Error(`인쇄 뷰 로드 실패: ${description}`));
    });

    win.once('closed', () => {
      clearTimeout(timer);
      if (pendingJobs.has(jobId)) {
        pendingJobs.delete(jobId);
        reject(new Error('인쇄 창이 예기치 않게 닫혔습니다.'));
      }
    });
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    const targetUrl = `${devServerUrl}?mode=print&jobId=${encodeURIComponent(jobId)}`;
    await win.loadURL(targetUrl);
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { mode: 'print', jobId },
    });
  }

  await readyPromise;
  return { win, jobId };
}

export async function exportPdfBuffer(payloadInput: Omit<PrintPayload, 'includeCssPageHeaders'>): Promise<Buffer> {
  const payload: PrintPayload = {
    ...payloadInput,
    includeCssPageHeaders: false,
  };

  const { win, jobId } = await createPrintWindow(payload);
  try {
    const { settings } = payload;
    const hasHeaderOrFooter = settings.showHeader || settings.showFooter;

    // Reserve enough vertical space in inches when Chromium's header/footer template is enabled.
    const minHeaderFooterInches = mmToInches(12);
    const topInches = settings.showHeader
      ? Math.max(mmToInches(settings.margins.top), minHeaderFooterInches)
      : mmToInches(settings.margins.top);
    const bottomInches = settings.showFooter
      ? Math.max(mmToInches(settings.margins.bottom), minHeaderFooterInches)
      : mmToInches(settings.margins.bottom);

    return await win.webContents.printToPDF({
      pageSize: resolvePdfPageSize(settings.paperSize),
      landscape: settings.orientation === 'landscape',
      printBackground: true,
      margins: {
        top: topInches,
        bottom: bottomInches,
        left: mmToInches(settings.margins.left),
        right: mmToInches(settings.margins.right),
      },
      displayHeaderFooter: hasHeaderOrFooter,
      headerTemplate: buildHeaderTemplate(payload),
      footerTemplate: buildFooterTemplate(settings),
    });
  } finally {
    pendingJobs.delete(jobId);
    if (!win.isDestroyed()) {
      win.close();
    }
  }
}

export function registerPrintHandlers(): void {
  ipcMain.handle('print:get-payload', (_event, jobId: string) => {
    return pendingJobs.get(jobId)?.payload ?? null;
  });

  ipcMain.on('print:ready', (_event, jobId: string) => {
    const job = pendingJobs.get(jobId);
    job?.resolveReady?.();
  });

  ipcMain.on('print:error', (_event, jobId: string, message: string) => {
    const job = pendingJobs.get(jobId);
    job?.rejectReady?.(new Error(message || '인쇄 준비 중 오류가 발생했습니다.'));
  });

  ipcMain.handle('print:execute', async (_event, payloadInput: Omit<PrintPayload, 'includeCssPageHeaders'>) => {
    const payload: PrintPayload = {
      ...payloadInput,
      includeCssPageHeaders: true,
    };

    let win: BrowserWindow | null = null;
    let jobId = '';
    try {
      const created = await createPrintWindow(payload);
      win = created.win;
      jobId = created.jobId;

      return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        if (!win || win.isDestroyed()) {
          resolve({ ok: false, error: '인쇄 창을 초기화할 수 없습니다.' });
          return;
        }

        win.webContents.print(
          {
            silent: false,
            printBackground: true,
            landscape: payload.settings.orientation === 'landscape',
            pageSize: resolveWebPrintPageSize(payload.settings.paperSize),
          },
          (success, failureReason) => {
            if (win && !win.isDestroyed()) {
              win.close();
            }
            if (success) {
              resolve({ ok: true });
            } else if (failureReason === 'cancelled' || failureReason === 'canceled') {
              resolve({ ok: false });
            } else {
              resolve({ ok: false, error: failureReason || '인쇄가 취소되었거나 실패했습니다.' });
            }
          },
        );
      });
    } catch (error) {
      if (win && !win.isDestroyed()) {
        win.close();
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : '인쇄 실행에 실패했습니다.',
      };
    } finally {
      if (jobId) {
        pendingJobs.delete(jobId);
      }
    }
  });

  ipcMain.handle('print:export-pdf', async (_event, payloadInput: Omit<PrintPayload, 'includeCssPageHeaders'>) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'PDF로 내보내기',
      defaultPath: sanitizePdfFileName(payloadInput.title),
      filters: [{ name: 'PDF 문서', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      const pdfBuffer = await exportPdfBuffer(payloadInput);
      await fs.writeFile(filePath, pdfBuffer);
      return { ok: true, filePath };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'PDF 생성에 실패했습니다.',
      };
    }
  });
}
