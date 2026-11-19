import type { FrontmatterData } from '../types/document';

export interface ParsedFrontmatter {
  data: FrontmatterData;
  body: string;
  lineOffset: number;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineArray(rawValue: string): string[] | null {
  const trimmed = rawValue.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(',')
    .map((item) => unquote(item))
    .filter((item) => item.length > 0);
}

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const lines = markdown.split(/\r?\n/);
  if (lines.length < 3 || lines[0].trim() !== '---') {
    return {
      data: {},
      body: markdown,
      lineOffset: 0,
    };
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed === '---' || trimmed === '...') {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    return {
      data: {},
      body: markdown,
      lineOffset: 0,
    };
  }

  const yamlLines = lines.slice(1, endIdx);
  const raw: Record<string, string | string[]> = {};
  let currentListKey: string | null = null;

  for (const line of yamlLines) {
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentListKey) {
      const existing = raw[currentListKey];
      const item = unquote(listMatch[1]);
      if (Array.isArray(existing) && item) {
        existing.push(item);
      }
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kvMatch) {
      currentListKey = null;
      continue;
    }

    const key = kvMatch[1].trim();
    const rawValue = kvMatch[2].trim();

    if (!rawValue) {
      raw[key] = [];
      currentListKey = key;
      continue;
    }

    currentListKey = null;
    const inlineArr = parseInlineArray(rawValue);
    if (inlineArr) {
      raw[key] = inlineArr;
    } else {
      raw[key] = unquote(rawValue);
    }
  }

  const data: FrontmatterData = {
    raw,
  };

  if (typeof raw.title === 'string') data.title = raw.title;
  if (typeof raw.author === 'string') data.author = raw.author;
  if (typeof raw.date === 'string') data.date = raw.date;
  if (typeof raw.description === 'string') data.description = raw.description;
  if (Array.isArray(raw.tags)) {
    data.tags = raw.tags;
  } else if (typeof raw.tags === 'string' && raw.tags.length > 0) {
    data.tags = raw.tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const body = lines.slice(endIdx + 1).join('\n');
  return {
    data,
    body,
    lineOffset: endIdx + 1,
  };
}
