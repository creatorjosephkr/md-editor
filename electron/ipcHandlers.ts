import { app, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileTreeNode } from '../src/types/document';
import type { AppPersistedState } from '../src/types/electron';
import { DEFAULT_PRINT_SETTINGS } from '../src/types/print';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.txt']);
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp'];
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-electron', 'release']);
const MAX_RECENT_FILES = 15;
const MAX_TREE_DEPTH = 6;

const DEFAULT_APP_STATE: AppPersistedState = {
  recentFiles: [],
  lastFolderPath: null,
  uiTheme: 'light',
  docTheme: 'github',
  printSettings: DEFAULT_PRINT_SETTINGS,
};

function getStateFilePath(): string {
  return path.join(app.getPath('userData'), 'meok-state.json');
}

function mergeAppState(raw: Partial<AppPersistedState> | null | undefined): AppPersistedState {
  const safe = raw ?? {};
  const recentFiles = Array.isArray(safe.recentFiles)
    ? safe.recentFiles.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_FILES)
    : DEFAULT_APP_STATE.recentFiles;

  return {
    recentFiles,
    lastFolderPath: typeof safe.lastFolderPath === 'string' ? safe.lastFolderPath : null,
    uiTheme: safe.uiTheme === 'dark' ? 'dark' : 'light',
    docTheme:
      safe.docTheme === 'report' || safe.docTheme === 'minimal' || safe.docTheme === 'github'
        ? safe.docTheme
        : 'github',
    printSettings: {
      ...DEFAULT_PRINT_SETTINGS,
      ...(safe.printSettings ?? {}),
      margins: {
        ...DEFAULT_PRINT_SETTINGS.margins,
        ...(safe.printSettings?.margins ?? {}),
      },
    },
  };
}

async function readStateFile(): Promise<AppPersistedState> {
  try {
    const rawText = await fs.readFile(getStateFilePath(), 'utf-8');
    return mergeAppState(JSON.parse(rawText) as Partial<AppPersistedState>);
  } catch {
    return mergeAppState(null);
  }
}

async function writeStateFile(state: AppPersistedState): Promise<void> {
  const target = getStateFilePath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(state, null, 2), 'utf-8');
}

function isMarkdownFileName(name: string): boolean {
  return MARKDOWN_EXTENSIONS.has(path.extname(name).toLowerCase());
}

async function scanDirectoryTree(dirPath: string, depth = 0): Promise<FileTreeNode[]> {
  if (depth > MAX_TREE_DEPTH) {
    return [];
  }

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs: FileTreeNode[] = [];
  const files: FileTreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      let childDirEntries: string[] = [];
      try {
        childDirEntries = await fs.readdir(fullPath);
      } catch {
        continue;
      }

      const children = await scanDirectoryTree(fullPath, depth + 1);
      const isGenuinelyEmpty = childDirEntries.length === 0 && depth <= 5;
      if (children.length > 0 || isGenuinelyEmpty) {
        dirs.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          children,
        });
      }
    } else if (entry.isFile() && isMarkdownFileName(entry.name)) {
      files.push({
        name: entry.name,
        path: fullPath,
        isDirectory: false,
      });
    }
  }

  const compareNames = (a: FileTreeNode, b: FileTreeNode) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

  dirs.sort(compareNames);
  files.sort(compareNames);
  return [...dirs, ...files];
}

export function registerIpcHandlers(): void {
  ipcMain.handle('file:open-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '마크다운 파일 열기',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Markdown 문서', extensions: ['md', 'markdown', 'mdx', 'txt'] },
        { name: '모든 파일', extensions: ['*'] },
      ],
    });

    if (canceled || filePaths.length === 0) {
      return [];
    }

    const results = await Promise.all(
      filePaths.map(async (filePath) => {
        const content = await fs.readFile(filePath, 'utf-8');
        return {
          filePath,
          name: path.basename(filePath),
          content,
        };
      }),
    );

    return results;
  });

  ipcMain.handle('folder:open-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '폴더 열기',
      properties: ['openDirectory'],
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    const folderPath = filePaths[0];
    const tree = await scanDirectoryTree(folderPath);
    return { folderPath, tree };
  });

  ipcMain.handle('folder:read-tree', async (_event, folderPath: string) => {
    if (!folderPath) return [];
    return scanDirectoryTree(folderPath);
  });

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return {
        ok: true,
        filePath,
        name: path.basename(filePath),
        content,
      };
    } catch (error) {
      return {
        ok: false,
        filePath,
        name: path.basename(filePath),
        error: error instanceof Error ? error.message : '파일을 읽을 수 없습니다.',
      };
    }
  });

  ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return {
        ok: true,
        filePath,
        name: path.basename(filePath),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '파일 저장에 실패했습니다.',
      };
    }
  });

  ipcMain.handle('file:save-as-dialog', async (_event, defaultName: string, content: string) => {
    const sanitizedName = defaultName.trim() || 'untitled.md';
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '다른 이름으로 저장',
      defaultPath: sanitizedName.endsWith('.md') ? sanitizedName : `${sanitizedName}.md`,
      filters: [
        { name: 'Markdown 문서', extensions: ['md', 'markdown'] },
        { name: '텍스트 파일', extensions: ['txt'] },
      ],
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return {
        ok: true,
        filePath,
        name: path.basename(filePath),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '파일 저장에 실패했습니다.',
      };
    }
  });

  ipcMain.handle('folder:create-file', async (_event, folderPath: string, fileName: string) => {
    const cleanName = path.basename(fileName.trim());
    if (!cleanName) {
      return { ok: false, error: '파일 이름을 입력하세요.' };
    }

    const finalName = /\.(md|markdown|mdx|txt)$/i.test(cleanName) ? cleanName : `${cleanName}.md`;
    const resolvedFolder = path.resolve(folderPath);
    const targetPath = path.resolve(resolvedFolder, finalName);

    if (!targetPath.startsWith(resolvedFolder + path.sep)) {
      return { ok: false, error: '유효하지 않은 파일 경로입니다.' };
    }

    try {
      await fs.access(targetPath);
      return { ok: false, error: '같은 이름의 파일이 이미 존재합니다.' };
    } catch {
      // File does not exist; safe to create.
    }

    try {
      const title = finalName.replace(/\.[^.]+$/, '');
      await fs.writeFile(targetPath, `# ${title}\n\n`, 'utf-8');
      return {
        ok: true,
        filePath: targetPath,
        name: finalName,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '새 파일을 만들 수 없습니다.',
      };
    }
  });

  ipcMain.handle('file:pick-image', async (_event, baseDir: string | null) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '이미지 선택',
      properties: ['openFile'],
      filters: [{ name: '이미지 파일', extensions: IMAGE_EXTENSIONS }],
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    const selected = filePaths[0];
    if (baseDir) {
      const relative = path.relative(baseDir, selected).split(path.sep).join('/');
      if (!relative.startsWith('.') && !relative.startsWith('/')) {
        return `./${relative}`;
      }
      return relative;
    }

    return selected;
  });

  ipcMain.handle('shell:show-in-folder', async (_event, filePath: string) => {
    if (filePath) {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
        await shell.openExternal(url);
      }
    } catch {
      // Ignore invalid URLs
    }
  });

  ipcMain.handle('state:load', async () => {
    return readStateFile();
  });

  ipcMain.handle('state:save', async (_event, partial: Partial<AppPersistedState>) => {
    const current = await readStateFile();
    const merged = mergeAppState({
      ...current,
      ...partial,
      printSettings: partial.printSettings
        ? {
            ...current.printSettings,
            ...partial.printSettings,
            margins: {
              ...current.printSettings.margins,
              ...(partial.printSettings.margins ?? {}),
            },
          }
        : current.printSettings,
    });
    await writeStateFile(merged);
    return merged;
  });
}
