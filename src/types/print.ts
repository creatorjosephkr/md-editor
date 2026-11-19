export type PaperSize = 'A4' | 'Letter' | 'Legal' | 'B5';

export type Orientation = 'portrait' | 'landscape';

export type DocumentTheme = 'github' | 'report' | 'minimal';

export type FooterFormat = 'slash' | 'dash' | 'pageOf';

export interface PrintMarginsMm {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PrintSettings {
  paperSize: PaperSize;
  orientation: Orientation;
  margins: PrintMarginsMm;
  fontSize: number;
  lineHeight: number;
  showHeader: boolean;
  headerText: string;
  showFooter: boolean;
  footerFormat: FooterFormat;
  hrAsPageBreak: boolean;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'A4',
  orientation: 'portrait',
  margins: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
  fontSize: 14,
  lineHeight: 1.7,
  showHeader: false,
  headerText: '{{title}}',
  showFooter: true,
  footerFormat: 'slash',
  hrAsPageBreak: false,
};

export const PAPER_DIMENSIONS_MM: Record<PaperSize, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: 'A4 (210 × 297 mm)' },
  Letter: { width: 215.9, height: 279.4, label: 'Letter (8.5 × 11 in)' },
  Legal: { width: 215.9, height: 355.6, label: 'Legal (8.5 × 14 in)' },
  B5: { width: 176, height: 250, label: 'B5 (176 × 250 mm)' },
};

export interface PrintPayload {
  title: string;
  html: string;
  docTheme: DocumentTheme;
  settings: PrintSettings;
  includeCssPageHeaders: boolean;
}
