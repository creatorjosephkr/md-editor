import mermaid from 'mermaid';

let renderCounter = 0;
let lastTheme: 'light' | 'dark' | null = null;
const svgCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 120;

function ensureMermaidTheme(theme: 'light' | 'dark'): void {
  if (lastTheme === theme) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'strict',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
  });
  lastTheme = theme;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export async function hydrateMermaidBlocks(
  container: HTMLElement,
  theme: 'light' | 'dark',
): Promise<void> {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('.mermaid-block[data-mermaid-code]'));
  if (blocks.length === 0) return;

  ensureMermaidTheme(theme);

  for (const block of blocks) {
    const encoded = block.getAttribute('data-mermaid-code') ?? '';
    let code = '';
    try {
      code = decodeURIComponent(encoded);
    } catch {
      code = encoded;
    }

    if (!code.trim()) {
      block.innerHTML = '<div class="mermaid-error">빈 Mermaid 다이어그램입니다.</div>';
      continue;
    }

    const cacheKey = `${theme}::${code}`;
    const cached = svgCache.get(cacheKey);
    if (cached) {
      block.innerHTML = cached;
      continue;
    }

    renderCounter += 1;
    const renderId = `meok-mermaid-${renderCounter}`;

    try {
      const { svg, bindFunctions } = await mermaid.render(renderId, code);
      if (svgCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = svgCache.keys().next().value;
        if (oldestKey) svgCache.delete(oldestKey);
      }
      svgCache.set(cacheKey, svg);
      block.innerHTML = svg;
      bindFunctions?.(block);
    } catch (error) {
      const stray = document.getElementById(`d${renderId}`) ?? document.getElementById(renderId);
      stray?.remove();
      const message = error instanceof Error ? error.message : 'Mermaid 구문 오류';
      block.innerHTML = `<div class="mermaid-error"><strong>Mermaid 오류:</strong> ${escapeHtml(message)}</div>`;
    }
  }
}
