# 먹(Meok) — 마크다운(MD) 에디터

> 마크다운 문서를 깔끔하게 미리보고, 가볍게 편집하며, 실제 용지 비율에 맞춰 인쇄 및 PDF로 저장할 수 있는 데스크톱 마크다운 에디터입니다.

---

## 애플리케이션 이름 이야기

**Meok**<span style="font-weight: normal;"> = </span>**M**<span style="font-weight: normal;">arkdown · </span>**E**<span style="font-weight: normal;">ditor · </span>**O**<span style="font-weight: normal;">utput · </span>**K**<span style="font-weight: normal;">it</span>

#### 스토리텔링


> "**Meok**"은 **M**arkdown **E**ditor **O**utput **K**it의 첫 글자를 딴 이름입니다. 
> 워드프로세서처럼 쉽게 마크다운을 쓰고(Editor), 원하는 형태로 자유롭게 내보내는(Output) 올인원 도구(Kit)라는 의미를 담았습니다. 
> 동시에 "**먹처럼 진하게 글을 써내려간다**"는 한글 이름의 정서도 함께 갖고 있습니다.

#### **정리**

- **한글명**: 먹
- **영문명**: Meok
- **백로닉**: Markdown · Editor · Output · Kit
- **한 줄 카피**: "마크다운! 먹처럼 진하게 — Meok"

<div data-raw-html="true" style="text-align: center; margin: 1em 0px;"><img src="https://raw.githubusercontent.com/creatorjosephkr/images/main/images/Gemini_Generated_Image_fmzy7rfmzy7rfmzy_1783840513122.png" alt="" style="max-width: 100%; width: 100%;"></div>



## 주요 기능

### 1. 편집 및 실시간 미리보기
- **순수 텍스트 소스 편집기**: 왼쪽 소스 창은 문법 색상이나 불필요한 스타일링 없이 순수한 고정폭 텍스트만 깔끔하게 표시합니다. (CodeMirror 6 기반 실행 취소/다시 실행, 검색 `⌘F` 지원)
- **간편 서식 툴바**: 제목(`H1`–`H3`), 굵게/기울임/취소선/인라인 코드, 목록·번호·체크리스트, 인용구, 링크, 로컬 이미지 선택 삽입, 표, 코드 블록, 수식(`$$`), Mermaid, 페이지 나누기(`<!-- pagebreak -->`) 삽입을 지원합니다.
- **4가지 보기 모드**: 편집(`⌘1`) / 분할(`⌘2`) / 미리보기(`⌘3`) / 인쇄 뷰(`⌘4`) 전환 및 분할 창 스크롤 동기화·크기 조절을 지원합니다.

### 2. 풍부한 마크다운 렌더링
- **GFM & 확장 문법**: 표(Table), 클릭하여 바로 상태를 전환할 수 있는 체크리스트(`- [ ]` / `- [x]`), 각 코드 블록 복사 버튼이 포함된 구문 강조(`highlight.js`)를 지원합니다.
- **수식 & 다이어그램**: **KaTeX** 인라인(`$...$`) 및 블록(`$$...$$`) 수식과 **Mermaid** 다이어그램 렌더링을 지원합니다.
- **YAML Frontmatter & 로컬 이미지**: 문서 상단의 `title`, `author`, `date`, `tags` 메타데이터를 카드로 표시하며, 문서 기준 상대 경로 이미지도 즉시 미리보기와 인쇄에 반영합니다.

### 3. 문서 및 탐색 관리
- **멀티 탭 & 파일 열기**: 여러 마크다운 문서를 탭으로 동시에 열 수 있으며, 창으로 파일을 끌어다 놓아 바로 열 수 있습니다.
- **사이드바 (파일 / 목차)**:
  - **파일**: 열린 폴더의 마크다운 파일 트리 탐색, 새 파일 생성, 최근 파일 목록
  - **목차(TOC)**: 문서 내 제목(`#`–`######`) 자동 추출 및 클릭 시 해당 위치로 바로 이동

### 4. 용지 기반 인쇄 미리보기 & PDF 저장
- **실제 용지 비율 시트 미리보기**: `A4`, `Letter`, `Legal`, `B5` 및 세로/가로 방향에 맞춰 페이지가 어떻게 나뉘는지 화면에서 미리 확인할 수 있습니다. (여백 안내선 표시, 확대/축소 지원)
- **세부 레이아웃 설정**:
  - 상·하·좌·우 여백(`mm`) 개별 지정 및 프리셋(좁게/보통/넓게)
  - 본문 글꼴 크기 및 줄 간격 조절
  - 머리글(`{{title}}` 자동 치환) 및 바닥글 페이지 번호(`1 / 5`, `- 1 -`, `Page 1 of 5`)
  - `<!-- pagebreak -->` 및 선택적 수평선(`---`) 페이지 나누기
- **문서 테마 프리셋 & UI 테마**: **GitHub / 보고서(명조) / 미니멀** 3가지 문서 스타일과 앱 UI 라이트/다크 모드를 지원합니다. (인쇄 및 PDF 출력은 항상 깨끗한 흰 종이 기준으로 출력됩니다.)

---

## 설치 및 실행

### macOS 설치
1. [Releases](https://github.com/creatorjosephkr/md-editor/releases) 페이지에서 `Meok-1.0.0-macOS-arm64.dmg` 파일을 다운로드합니다.
2. DMG를 열고 **Meok**을 **응용 프로그램(Applications)** 폴더로 끌어다 설치합니다. (Finder 및 Dock에는 **먹(Meok)**으로 표시됩니다.)

### 소스 코드에서 실행 및 빌드
```bash
# 의존성 설치
npm install

# 개발 모드 실행 (Vite + Electron)
npm run dev

# 테스트 및 타입 검사
npm test
npm run typecheck

# 프로덕션 빌드 및 설치 파일 생성 (release/ 폴더에 생성)
npm run dist
```

---

## 라이선스 안내

이 프로그램은 **무료**로 배포되며, 개인 및 업무 환경 등 누구나 자유롭게 무료로 사용할 수 있습니다.

---

## 개발자

- **이름**: 크리에이터 요셉
- **이메일**: [jospeh@kakao.com](mailto:jospeh@kakao.com)
- **GitHub**: https://github.com/creatorjosephkr/md-editor
