import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AppPersistedState, ElectronAPI, MenuAction } from '../src/types/electron';
import type { PrintPayload } from '../src/types/print';

const api: ElectronAPI = {
  platform: process.platform,
  openFileDialog: () => ipcRenderer.invoke('file:open-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('folder:open-dialog'),
  readDirectoryTree: (folderPath: string) => ipcRenderer.invoke('folder:read-tree', folderPath),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
  saveFileAsDialog: (defaultName: string, content: string) =>
    ipcRenderer.invoke('file:save-as-dialog', defaultName, content),
  createFileInFolder: (folderPath: string, fileName: string) =>
    ipcRenderer.invoke('folder:create-file', folderPath, fileName),
  pickImageDialog: (baseDir: string | null) => ipcRenderer.invoke('file:pick-image', baseDir),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:show-in-folder', filePath),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  loadAppState: () => ipcRenderer.invoke('state:load'),
  saveAppState: (partialState: Partial<AppPersistedState>) => ipcRenderer.invoke('state:save', partialState),
  printDocument: (payload: Omit<PrintPayload, 'includeCssPageHeaders'>) =>
    ipcRenderer.invoke('print:execute', payload),
  exportPdf: (payload: Omit<PrintPayload, 'includeCssPageHeaders'>) =>
    ipcRenderer.invoke('print:export-pdf', payload),
  getPrintPayload: (jobId: string) => ipcRenderer.invoke('print:get-payload', jobId),
  notifyPrintReady: (jobId: string) => ipcRenderer.send('print:ready', jobId),
  notifyPrintError: (jobId: string, message: string) => ipcRenderer.send('print:error', jobId, message),
  onMenuAction: (callback: (action: MenuAction) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: MenuAction) => callback(action);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
  onOpenFileFromOS: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('app:open-file-from-os', listener);
    return () => ipcRenderer.removeListener('app:open-file-from-os', listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
