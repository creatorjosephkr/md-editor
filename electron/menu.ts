import { app, BrowserWindow, Menu } from 'electron';
import type { MenuAction } from '../src/types/electron';

function sendAction(action: MenuAction): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send('menu:action', action);
  }
}

export function buildAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const, label: '먹(Meok)에 관하여' },
              { type: 'separator' as const },
              {
                label: '인쇄 및 스타일 설정...',
                accelerator: 'CmdOrCtrl+,',
                click: () => sendAction('toggle-settings'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const, label: '종료' },
            ],
          },
        ]
      : []),
    {
      label: '파일',
      submenu: [
        {
          label: '새 문서',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendAction('new-file'),
        },
        {
          label: '파일 열기...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendAction('open-file'),
        },
        {
          label: '폴더 열기...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendAction('open-folder'),
        },
        { type: 'separator' },
        {
          label: '저장',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendAction('save'),
        },
        {
          label: '다른 이름으로 저장...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendAction('save-as'),
        },
        {
          label: '탭 닫기',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendAction('close-tab'),
        },
        { type: 'separator' },
        {
          label: '인쇄...',
          accelerator: 'CmdOrCtrl+P',
          click: () => sendAction('print'),
        },
        {
          label: 'PDF로 내보내기...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => sendAction('export-pdf'),
        },
        ...(!isMac
          ? [{ type: 'separator' as const }, { role: 'quit' as const, label: '종료' }]
          : []),
      ],
    },
    {
      label: '편집',
      submenu: [
        { role: 'undo', label: '실행 취소' },
        { role: 'redo', label: '다시 실행' },
        { type: 'separator' },
        { role: 'cut', label: '오려두기' },
        { role: 'copy', label: '복사' },
        { role: 'paste', label: '붙여넣기' },
        { role: 'selectAll', label: '전체 선택' },
      ],
    },
    {
      label: '보기',
      submenu: [
        {
          label: '편집 모드',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendAction('view-editor'),
        },
        {
          label: '분할 보기',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendAction('view-split'),
        },
        {
          label: '미리보기',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendAction('view-preview'),
        },
        {
          label: '인쇄 미리보기',
          accelerator: 'CmdOrCtrl+4',
          click: () => sendAction('view-print-preview'),
        },
        { type: 'separator' },
        {
          label: '사이드바 토글',
          accelerator: 'CmdOrCtrl+\\',
          click: () => sendAction('toggle-sidebar'),
        },
        {
          label: '인쇄 및 스타일 설정 토글',
          accelerator: isMac ? 'CmdOrCtrl+Shift+P' : 'CmdOrCtrl+,',
          click: () => sendAction('toggle-settings'),
        },
        {
          label: '화면 테마 전환 (라이트/다크)',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => sendAction('toggle-ui-theme'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools', label: '개발자 도구' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '창',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
