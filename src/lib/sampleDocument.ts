export const SAMPLE_DOCUMENT_NAME = '시작하기.md';

export const SAMPLE_DOCUMENT_CONTENT = `---
title: 먹(Meok) 사용 가이드
author: 먹(Meok)
date: 2026-11-19
tags: [Markdown, 인쇄, PDF, 수식, Mermaid]
---

# 먹(Meok)에 오신 것을 환영합니다

**먹(Meok)**은 마크다운(MD) 문서를 깔끔하게 미리보고, 가볍게 편집하며, 실제 용지 비율에 맞춰 **인쇄 및 PDF로 저장**할 수 있는 마크다운(MD) 에디터입니다.

## 주요 기능 미리보기

- [x] 실시간 좌우 분할 미리보기 및 스크롤 동기화
- [x] GFM 표, 체크리스트(클릭하여 체크 상태 전환 가능), 코드 하이라이팅
- [x] KaTeX 수식 및 Mermaid 다이어그램 지원
- [ ] 우측 **설정** 패널에서 용지·여백·테마를 조정한 뒤 PDF로 내보내기

### 1. 코드 블록 하이라이팅

\`\`\`typescript
interface PrintJob {
  title: string;
  paperSize: 'A4' | 'Letter' | 'Legal' | 'B5';
  orientation: 'portrait' | 'landscape';
}

export function formatSummary(job: PrintJob): string {
  return \`[\${job.paperSize} / \${job.orientation}] \${job.title}\`;
}
\`\`\`

### 2. 표(Table) 스타일

| 단축키 (macOS) | 기능 | 설명 |
| :--- | :--- | :--- |
| \`⌘ + O\` | 파일 열기 | 로컬 마크다운 파일을 새 탭으로 엽니다 |
| \`⌘ + S\` | 저장 | 현재 문서를 저장합니다 |
| \`⌘ + 1 ~ 4\` | 보기 전환 | 편집 / 분할 / 미리보기 / 인쇄 미리보기 |
| \`⌘ + P\` | 인쇄 | 시스템 인쇄 대화상자 실행 |
| \`⌘ + ⇧ + E\` | PDF 내보내기 | 용지·머리글·페이지 번호를 포함해 PDF 저장 |

### 3. 수식 (KaTeX) & 가격 표기 안전성

인라인 수식 $E = mc^2$ 또는 $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$ 를 자연스럽게 렌더링하며, 일반 가격 표기(예: 커피 $5, 노트 $10)는 수식으로 오인하지 않습니다.

$$
f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi)\\, e^{2\\pi i \\xi x}\\, d\\xi
$$

<!-- pagebreak -->

## 4. Mermaid 다이어그램 및 인쇄 레이아웃

\`\`\`mermaid
flowchart LR
  A[마크다운 작성 / 열기] --> B{보기 모드 선택}
  B --> C[분할 미리보기]
  B --> D[인쇄 미리보기]
  D --> E[용지·여백·테마 조정]
  E --> F[PDF 저장 또는 인쇄]
\`\`\`

> **팁:** 문서 본문에 \`<!-- pagebreak -->\` 를 입력하거나 우측 **설정** 패널에서 *"수평선(---)을 페이지 나누기로 사용"* 옵션을 켜면 원하는 위치에서 정확하게 페이지를 나눌 수 있습니다.

### 5. 문서 테마 프리셋

상단 또는 우측 설정 패널에서 다음 3가지 프리셋을 전환해 보세요.

1. **GitHub** — 기술 문서와 README에 최적화된 또렷한 레이아웃
2. **보고서 / 논문** — 명조 계열 타이포그래피와 격식 있는 표 스타일
3. **미니멀** — 여백이 넉넉한 모던 노트·에세이 스타일
`;
