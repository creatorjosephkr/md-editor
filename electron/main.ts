import { app, BrowserWindow, nativeImage, net, protocol, shell } from 'electron';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerIpcHandlers } from './ipcHandlers';
import { buildAppMenu } from './menu';
import { exportPdfBuffer, registerPrintHandlers } from './printService';
import { DEFAULT_PRINT_SETTINGS } from '../src/types/print';

const APP_TITLE = '먹(Meok) — 마크다운(MD) 에디터';

function resolveAppIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, '../assets/icon.png'),
    path.join(app.getAppPath(), 'assets/icon.png'),
  ];
  return candidates.find((candidate) => fsSync.existsSync(candidate));
}

function isSmokeTestMode(): boolean {
  return process.env.MEOK_SMOKE_TEST === '1' || process.env.MARKPRESS_SMOKE_TEST === '1';
}

const ALLOWED_ASSET_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.bmp',
  '.ico',
]);

const MARKDOWN_CLI_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.txt']);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'md-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
const pendingOpenFiles: string[] = [];

function extractCliMarkdownPath(argv: string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith('-')) continue;
    if (arg === '.' || arg.endsWith('electron')) continue;
    const ext = path.extname(arg).toLowerCase();
    if (MARKDOWN_CLI_EXTENSIONS.has(ext)) {
      return path.resolve(arg);
    }
  }
  return null;
}

function sendOrQueueOpenFile(filePath: string): void {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoadingMainFrame()) {
    mainWindow.webContents.send('app:open-file-from-os', filePath);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    pendingOpenFiles.push(filePath);
  }
}

function flushPendingOpenFiles(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  while (pendingOpenFiles.length > 0) {
    const nextPath = pendingOpenFiles.shift();
    if (nextPath) {
      mainWindow.webContents.send('app:open-file-from-os', nextPath);
    }
  }
}

async function createMainWindow(): Promise<BrowserWindow> {
  const isSmokeTest = isSmokeTestMode();
  const iconPath = resolveAppIconPath();

  const win = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 920,
    minHeight: 600,
    show: !isSmokeTest,
    title: APP_TITLE,
    icon: iconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 11 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        void shell.openExternal(url);
      }
    } catch {
      // Ignore invalid external URLs
    }
    return { action: 'deny' };
  });

  win.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      flushPendingOpenFiles();
    }, 150);
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await win.loadURL(devServerUrl);
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return win;
}

const cliPath = extractCliMarkdownPath(process.argv);
if (cliPath) {
  pendingOpenFiles.push(cliPath);
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  sendOrQueueOpenFile(filePath);
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = extractCliMarkdownPath(argv);
    if (filePath) {
      sendOrQueueOpenFile(filePath);
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    app.setName('먹(Meok)');
    const iconPath = resolveAppIconPath();
    if (!app.isPackaged && iconPath) {
      const appIcon = nativeImage.createFromPath(iconPath);
      if (!appIcon.isEmpty() && process.platform === 'darwin') {
        app.dock?.setIcon(appIcon);
      }
    }
    app.setAboutPanelOptions({
      applicationName: '먹(Meok)',
      applicationVersion: app.getVersion(),
      credits: '마크다운(MD) 에디터',
      iconPath,
    });

    protocol.handle('md-asset', async (request) => {
      try {
        const parsed = new URL(request.url);
        const rawPath = parsed.searchParams.get('path');
        if (!rawPath) {
          return new Response('Missing asset path', { status: 400 });
        }

        const resolvedPath = path.resolve(rawPath);
        const ext = path.extname(resolvedPath).toLowerCase();
        if (!ALLOWED_ASSET_EXTENSIONS.has(ext)) {
          return new Response('Forbidden asset type', { status: 403 });
        }

        const stat = await fs.stat(resolvedPath);
        if (!stat.isFile()) {
          return new Response('Not a file', { status: 404 });
        }

        return net.fetch(pathToFileURL(resolvedPath).href);
      } catch {
        return new Response('Asset not found', { status: 404 });
      }
    });

    registerIpcHandlers();
    registerPrintHandlers();
    buildAppMenu();

    mainWindow = await createMainWindow();

    if (isSmokeTestMode()) {
      const rendererErrors: string[] = [];
      mainWindow.webContents.on('console-message', (details) => {
        if (details.level === 'error') {
          rendererErrors.push(details.message);
        }
      });

      try {
        await mainWindow.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const deadline = Date.now() + 5000;
            const check = () => {
              if (window.electronAPI && document.querySelector("#root")?.children.length > 0) {
                resolve(true);
              } else if (Date.now() > deadline) {
                resolve(false);
              } else {
                setTimeout(check, 50);
              }
            };
            check();
          })
        `);

        const uiCheck = (await mainWindow.webContents.executeJavaScript(`
          (() => {
            const header = document.querySelector('header');
            const topDragRow = header?.querySelector('.app-drag');
            const hasNoDragInTopRow = Boolean(topDragRow?.querySelector('.app-no-drag'));
            const text = header?.textContent ?? '';
            return {
              hasElectronApi: Boolean(window.electronAPI),
              hasRoot: (document.querySelector('#root')?.children.length ?? 0) > 0,
              hasBrandTitle: text.includes('먹(Meok)') && text.includes('마크다운(MD) 에디터'),
              topRowDraggableWithoutNoDrag: Boolean(topDragRow) && !hasNoDragInTopRow,
            };
          })()
        `)) as {
          hasElectronApi: boolean;
          hasRoot: boolean;
          hasBrandTitle: boolean;
          topRowDraggableWithoutNoDrag: boolean;
        };

        const iconResolved = Boolean(iconPath) && !nativeImage.createFromPath(iconPath ?? '').isEmpty();
        const mermaidEncoded = encodeURIComponent('flowchart LR\n  A[Start] --> B[PDF]');
        const pdfBuffer = await exportPdfBuffer({
          title: '먹(Meok) Smoke Test',
          html: `<h1>Smoke Test</h1><p>한글 &amp; KaTeX PDF 검증</p><div class="mermaid-block" data-mermaid-code="${mermaidEncoded}"></div>`,
          docTheme: 'github',
          settings: DEFAULT_PRINT_SETTINGS,
        });
        const header = pdfBuffer.subarray(0, 5).toString('ascii');
        const smokePdfPath = path.join(os.tmpdir(), `meok-smoke-${Date.now()}.pdf`);
        await fs.writeFile(smokePdfPath, pdfBuffer);
        await fs.unlink(smokePdfPath);

        console.log(
          JSON.stringify({
            smokeTest: 'ok',
            ...uiCheck,
            iconResolved,
            rendererErrors,
            pdfBytes: pdfBuffer.length,
            pdfHeader: header,
          }),
        );
        if (
          !uiCheck.hasElectronApi ||
          !uiCheck.hasRoot ||
          !uiCheck.hasBrandTitle ||
          !uiCheck.topRowDraggableWithoutNoDrag ||
          !iconResolved ||
          rendererErrors.length > 0 ||
          header !== '%PDF-'
        ) {
          app.exit(1);
          return;
        }
        app.exit(0);
      } catch (err) {
        console.error('Smoke test failed:', err);
        app.exit(1);
      }
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow().then((win) => {
          mainWindow = win;
        });
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
