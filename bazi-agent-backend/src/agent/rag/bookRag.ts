import { booksDirFingerprint, loadBookChunksFromDir, type BookChunk } from './chunkBooks.js';

export type BookRagSnippet = {
  source: string;
  heading: string;
  text: string;
  score: number;
  matchedKeywords: string[];
};

type IndexedChunk = BookChunk & {
  normalizedHeading: string;
  normalizedText: string;
};

type LoadedIndex = {
  chunks: IndexedChunk[];
};

let memoryIndex: LoadedIndex | null = null;
let memoryFingerprint: string | null = null;

const DOMAIN_KEYWORDS = [
  '用神',
  '喜神',
  '忌神',
  '相神',
  '调候',
  '格局',
  '从格',
  '化格',
  '财运',
  '事业',
  '工作',
  '婚姻',
  '感情',
  '妻子',
  '桃花',
  '行运',
  '大运',
  '流年',
  '正官',
  '七杀',
  '偏官',
  '正财',
  '偏财',
  '印绶',
  '正印',
  '偏印',
  '食神',
  '伤官',
  '比肩',
  '劫财',
  '建禄',
  '阳刃',
  '墓库',
  '刑冲',
  '月令',
  '日主',
];

const PREFACE_HINTS = ['序', '自序', '原序', '凡例', '前言'];
const HEADING_ONLY_KEYWORDS = new Set(['财']);

export function mapBookSourceToTitle(source: string): string {
  if (source === 'zipingzhenquan.md') {
    return '《子平真诠》';
  }
  if (source === 'zipingzhenquanjizhu.md') {
    return '《子平真诠集注》';
  }
  if (source === '穷通宝鉴.md') {
    return '《穷通宝鉴》';
  }
  return source;
}

export function normalizeBookSectionLabel(heading: string): string {
  return heading.replace(/^[一二三四五六七八九十百千0-9、\s]+/, '').trim() || heading.trim();
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function sourcePriority(source: string): number {
  if (source === 'zipingzhenquan.md') {
    return 3;
  }
  if (source === 'zipingzhenquanjizhu.md') {
    return 2;
  }
  if (source === '穷通宝鉴.md') {
    return 1;
  }
  return 0;
}

function dedupeChunks(chunks: BookChunk[]): IndexedChunk[] {
  const byText = new Map<string, IndexedChunk>();
  for (const chunk of chunks) {
    const normalizedText = normalizeText(chunk.text);
    const normalizedHeading = normalizeText(chunk.heading);
    const indexed: IndexedChunk = {
      ...chunk,
      normalizedText,
      normalizedHeading,
    };
    const existing = byText.get(normalizedText);
    if (!existing || sourcePriority(indexed.source) > sourcePriority(existing.source)) {
      byText.set(normalizedText, indexed);
    }
  }
  return [...byText.values()];
}

function ensureLoadedIndex(booksPath: string): LoadedIndex | null {
  const fingerprint = booksDirFingerprint(booksPath);
  if (fingerprint === 'missing') {
    return null;
  }

  if (memoryIndex && memoryFingerprint === fingerprint) {
    return memoryIndex;
  }

  const chunks = loadBookChunksFromDir(booksPath);
  if (chunks.length === 0) {
    return null;
  }

  memoryIndex = { chunks: dedupeChunks(chunks) };
  memoryFingerprint = fingerprint;
  return memoryIndex;
}

function extractQueryKeywords(queryText: string): string[] {
  const keywords = new Set<string>();
  const raw = queryText.trim();
  if (!raw) {
    return [];
  }

  for (const keyword of DOMAIN_KEYWORDS) {
    if (raw.includes(keyword)) {
      keywords.add(keyword);
    }
  }

  const dayMasterMatches = raw.match(/[甲乙丙丁戊己庚辛壬癸][金木水火土]/g) ?? [];
  for (const match of dayMasterMatches) {
    keywords.add(match);
  }

  if (/事业|工作|职业|升职|求职|创业/.test(raw)) {
    keywords.add('事业');
    keywords.add('工作');
    keywords.add('正官');
    keywords.add('行运');
  }
  if (/婚姻|感情|对象|恋爱|结婚|伴侣/.test(raw)) {
    keywords.add('婚姻');
    keywords.add('感情');
    keywords.add('妻子');
    keywords.add('桃花');
  }
  if (/财运|赚钱|收入|财富|投资/.test(raw)) {
    keywords.add('财运');
    keywords.add('财');
    keywords.add('正财');
    keywords.add('偏财');
  }

  return [...keywords].sort((a, b) => b.length - a.length);
}

function scoreChunk(chunk: IndexedChunk, keywords: string[]): { score: number; matchedKeywords: string[] } {
  let score = 0;
  const matchedKeywords: string[] = [];

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    let keywordScore = 0;
    if (chunk.normalizedHeading === normalizedKeyword) {
      keywordScore += 12;
    } else if (chunk.normalizedHeading.includes(normalizedKeyword)) {
      keywordScore += HEADING_ONLY_KEYWORDS.has(keyword) ? 10 : 8;
    }

    if (!HEADING_ONLY_KEYWORDS.has(keyword) && chunk.normalizedText.includes(normalizedKeyword)) {
      keywordScore += keyword.length >= 2 ? 3 : 1;
    }

    if (keywordScore > 0) {
      matchedKeywords.push(keyword);
      score += keywordScore;
    }
  }

  if (matchedKeywords.length > 0 && /论/.test(chunk.heading)) {
    score += 2;
  }

  if (PREFACE_HINTS.some((hint) => chunk.heading.includes(hint))) {
    score -= 6;
  }

  if (chunk.source === 'zipingzhenquan.md') {
    score += 1;
  }

  return { score, matchedKeywords };
}

export async function retrieveBookRagSnippets(params: {
  booksPath: string;
  queryText: string;
  topK: number;
  minScore?: number;
}): Promise<BookRagSnippet[]> {
  const trimmed = params.queryText.trim();
  if (!trimmed) {
    return [];
  }

  const index = ensureLoadedIndex(params.booksPath);
  if (!index) {
    return [];
  }

  const keywords = extractQueryKeywords(trimmed);
  if (keywords.length === 0) {
    return [];
  }

  const scored: BookRagSnippet[] = [];
  for (const ch of index.chunks) {
    const { score, matchedKeywords } = scoreChunk(ch, keywords);
    if (score < (params.minScore ?? 4)) {
      continue;
    }
    scored.push({
      source: ch.source,
      heading: ch.heading,
      text: ch.text,
      score,
      matchedKeywords,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const deduped: BookRagSnippet[] = [];
  const seenTexts = new Set<string>();
  for (const item of scored) {
    const textKey = normalizeText(item.text);
    if (seenTexts.has(textKey)) {
      continue;
    }
    seenTexts.add(textKey);
    deduped.push(item);
  }
  const k = Math.max(1, Math.min(params.topK, 20));
  return deduped.slice(0, k);
}
