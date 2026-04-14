import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type BookChunk = {
  id: string;
  source: string;
  heading: string;
  text: string;
};

const MAX_CHARS = 1400;
const OVERLAP = 180;

function splitOversized(part: string, file: string, partIndex: number, heading: string): BookChunk[] {
  if (part.length <= MAX_CHARS) {
    return [{ id: `${file}-${partIndex}`, source: file, heading, text: part }];
  }
  const out: BookChunk[] = [];
  let offset = 0;
  let sub = 0;
  while (offset < part.length) {
    const slice = part.slice(offset, offset + MAX_CHARS);
    out.push({
      id: `${file}-${partIndex}-${sub}`,
      source: file,
      heading: sub === 0 ? heading : `${heading}（续${sub}）`,
      text: slice,
    });
    offset += MAX_CHARS - OVERLAP;
    sub += 1;
  }
  return out;
}

const SKIP_FILES = new Set(['穷通宝鉴.md']);

export function loadBookChunksFromDir(booksDir: string): BookChunk[] {
  let names: string[];
  try {
    names = readdirSync(booksDir);
  } catch {
    return [];
  }

  const chunks: BookChunk[] = [];
  for (const file of names) {
    if (!file.endsWith('.md') || SKIP_FILES.has(file)) {
      continue;
    }
    const path = join(booksDir, file);
    let raw: string;
    try {
      raw = readFileSync(path, 'utf-8');
    } catch {
      continue;
    }
    const parts = raw.split(/\n(?=#{2,3}\s)/);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]?.trim() ?? '';
      if (!part) {
        continue;
      }
      const firstLine = part.split('\n')[0] ?? '';
      const heading = firstLine.replace(/^#+\s*/, '').slice(0, 120);
      chunks.push(...splitOversized(part, file, i, heading || file));
    }
  }
  return chunks;
}

export function booksDirFingerprint(booksDir: string): string {
  let names: string[];
  try {
    names = readdirSync(booksDir).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return 'missing';
  }
  const parts: string[] = [];
  for (const file of names) {
    try {
      const st = statSync(join(booksDir, file));
      parts.push(`${file}:${st.size}:${st.mtimeMs}`);
    } catch {
      parts.push(`${file}:?`);
    }
  }
  return parts.join('|');
}
