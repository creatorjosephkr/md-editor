import type { FileTreeNode, UiTheme } from './document';
import type { DocumentTheme, PrintPayload, PrintSettings } from './print';

export interface AppPersistedState {
  recentFiles: string[];
  lastFolderPath: string | null;
  uiTheme: UiTheme;
  docTheme: DocumentTheme;
  printSettings: PrintSettings;
}

export interface OpenedFileResult {
  filePath: string;
  name: string;
  content: string;
}

export interface SaveFileResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  name?: string;
  error?: string;
}

export interface PrintOperationResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export type MenuAction =
  | 'new-file'
  | 'open-file'
  | 'open-folder'
  | 'save'
  | 'save-as'
  | 'close-tab'
  | 'print'
  | 'export-pdf'
  | 'view-editor'
  | 'view-split'
  | 'view-preview'
  | 'view-print-preview'
  | 'toggle-sidebar'
  | 'toggle-settings'
  | 'toggle-ui-theme';

export interface ElectronAPI {
  platform: NodeJS.Platform;
  openFileDialog: () => Promise<OpenedFileResult[]>;
  openFolderDialog: () => Promise<{ folderPath: string; tree: FileTreeNode[] } | null>;
  readDirectoryTree: (folderPath: string) => Promise<FileTreeNode[]>;
  readFile: (filePath: string) => Promise<{ ok: boolean; filePath: string; name: string; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<SaveFileResult>;
  saveFileAsDialog: (defaultName: string, content: string) => Promise<SaveFileResult>;
  createFileInFolder: (folderPath: string, fileName: string) => Promise<SaveFileResult>;
  pickImageDialog: (baseDir: string | null) => Promise<string | null>;
  showItemInFolder: (filePath: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  getPathForFile: (file: File) => string;
  loadAppState: () => Promise<AppPersistedState>;
  saveAppState: (partialState: Partial<AppPersistedState>) => Promise<AppPersistedState>;
  printDocument: (payload: Omit<PrintPayload, 'includeCssPageHeaders'>) => Promise<PrintOperationResult>;
  exportPdf: (payload: Omit<PrintPayload, 'includeCssPageHeaders'>) => Promise<PrintOperationResult>;
  getPrintPayload: (jobId: string) => Promise<PrintPayload | null>;
  notifyPrintReady: (jobId: string) => void;
  notifyPrintError: (jobId: string, message: string) => void;
  onMenuAction: (callback: (action: MenuAction) => void) => () => void;
  onOpenFileFromOS: (callback: (filePath: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
