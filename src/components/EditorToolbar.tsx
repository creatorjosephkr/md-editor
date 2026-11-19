import {
  Bold,
  CheckSquare,
  Code,
  FileCode2,
  GitFork,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  SeparatorHorizontal,
  Sigma,
  Strikethrough,
  Table,
} from 'lucide-react';

export type ToolbarAction =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'ul'
  | 'ol'
  | 'task'
  | 'quote'
  | 'link'
  | 'image'
  | 'table'
  | 'codeblock'
  | 'math'
  | 'mermaid'
  | 'pagebreak';

interface EditorToolbarProps {
  onAction: (action: ToolbarAction) => void;
}

interface ToolbarItem {
  action: ToolbarAction;
  label: string;
  icon: typeof Bold;
}

const GROUPS: ToolbarItem[][] = [
  [
    { action: 'h1', label: '제목 1 (#)', icon: Heading1 },
    { action: 'h2', label: '제목 2 (##)', icon: Heading2 },
    { action: 'h3', label: '제목 3 (###)', icon: Heading3 },
  ],
  [
    { action: 'bold', label: '굵게 (**text**)', icon: Bold },
    { action: 'italic', label: '기울임 (*text*)', icon: Italic },
    { action: 'strike', label: '취소선 (~~text~~)', icon: Strikethrough },
    { action: 'code', label: '인라인 코드 (`code`)', icon: Code },
  ],
  [
    { action: 'ul', label: '글머리 기호 목록', icon: List },
    { action: 'ol', label: '번호 매기기 목록', icon: ListOrdered },
    { action: 'task', label: '체크리스트 (- [ ])', icon: CheckSquare },
    { action: 'quote', label: '인용구 (>)', icon: Quote },
  ],
  [
    { action: 'link', label: '링크 삽입', icon: Link2 },
    { action: 'image', label: '이미지 삽입', icon: ImageIcon },
    { action: 'table', label: '표 삽입', icon: Table },
    { action: 'codeblock', label: '코드 블록', icon: FileCode2 },
  ],
  [
    { action: 'math', label: '수식 블록 ($$)', icon: Sigma },
    { action: 'mermaid', label: 'Mermaid 다이어그램', icon: GitFork },
    { action: 'pagebreak', label: '페이지 나누기 삽입', icon: SeparatorHorizontal },
  ],
];

export function EditorToolbar({ onAction }: EditorToolbarProps) {
  return (
    <div
      className="no-print flex flex-wrap items-center gap-0.5 border-b px-2 py-1 select-none"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {GROUPS.map((group, groupIdx) => (
        <div key={groupIdx} className="flex items-center gap-0.5">
          {groupIdx > 0 && (
            <div
              className="mx-1 h-4 w-px"
              style={{ backgroundColor: 'var(--border-subtle)' }}
            />
          )}
          {group.map(({ action, label, icon: Icon }) => (
            <button
              key={action}
              type="button"
              onMouseDown={(e) => {
                // Keep editor focus intact while clicking toolbar buttons
                e.preventDefault();
              }}
              onClick={() => onAction(action)}
              title={label}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors hover:bg-black/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
