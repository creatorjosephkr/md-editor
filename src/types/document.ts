export type ViewMode = 'editor' | 'split' | 'preview' | 'print-preview';

export type UiTheme = 'light' | 'dark';

export interface OpenTab {
  id: string;
  filePath: string | null;
  name: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  isSample?: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
  line: number;
}

export interface FrontmatterData {
  title?: string;
  author?: string;
  date?: string;
  description?: string;
  tags?: string[];
  raw?: Record<string, string | string[]>;
}
