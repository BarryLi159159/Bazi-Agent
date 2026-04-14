import { booksDirFingerprint, loadBookChunksFromDir, type BookChunk } from './chunkBooks.js';
import { type RagTopic, chapterTopicBonus, chapterDenyPenalty } from './topicRouter.js';

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
  '用神', '喜神', '忌神', '相神', '调候', '格局', '从格', '化格',
  '财运', '事业', '工作', '婚姻', '感情', '妻子', '桃花',
  '行运', '大运', '流年',
  '正官', '七杀', '偏官', '正财', '偏财', '印绶', '正印', '偏印',
  '食神', '伤官', '比肩', '劫财', '建禄', '阳刃', '墓库', '刑冲', '月令', '日主',
  '从势', '从强', '化气', '禄神', '天德', '月德', '驿马', '华盖', '空亡',
  '合化', '暗合', '三合', '六合', '三会', '半合', '天干五合', '地支六冲',
  '穿害', '破格', '成格',
  '健康', '疾病', '身体',
  '官杀混杂', '伤官见官', '枭神夺食', '羊刃驾杀',
];

const HEADING_ONLY_KEYWORDS = new Set(['财']);

export function mapBookSourceToTitle(source: string): string {
  if (source === 'zipingzhenquan.md') {
    return '《子平真诠》';
  }
  if (source === 'zipingzhenquanjizhu.md') {
    return '《子平真诠评注》';
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

  const stemMatches = raw.match(/日主[：:]*\s*([甲乙丙丁戊己庚辛壬癸])/);
  if (stemMatches?.[1]) {
    keywords.add(stemMatches[1]);
  }

  const monthBranchMatch = raw.match(/月柱[：:]*\s*[甲乙丙丁戊己庚辛壬癸]?([子丑寅卯辰巳午未申酉戌亥])/);
  if (monthBranchMatch?.[1]) {
    keywords.add(monthBranchMatch[1]);
  }

  if (/事业|工作|职业|升职|求职|创业|官运|仕途/.test(raw)) {
    for (const kw of ['事业', '工作', '正官', '行运']) keywords.add(kw);
  }
  if (/婚姻|感情|对象|恋爱|结婚|伴侣|妻子|丈夫|桃花|姻缘|离婚/.test(raw)) {
    for (const kw of ['婚姻', '感情', '妻子', '桃花']) keywords.add(kw);
  }
  if (/财运|赚钱|收入|财富|投资|发财|破财/.test(raw)) {
    for (const kw of ['财运', '财', '正财', '偏财']) keywords.add(kw);
  }
  if (/健康|疾病|身体|生病|寿命|伤灾/.test(raw)) {
    for (const kw of ['健康', '疾病', '身体']) keywords.add(kw);
  }
  if (/大运|流年|行运|运势|运程/.test(raw)) {
    for (const kw of ['大运', '流年', '行运']) keywords.add(kw);
  }
  if (/用神|喜神|忌神|格局|调候|从格|化格|相神/.test(raw)) {
    for (const kw of ['用神', '喜神', '忌神', '格局', '调候', '从格', '化格', '相神']) {
      if (raw.includes(kw)) keywords.add(kw);
    }
  }

  return [...keywords].sort((a, b) => b.length - a.length);
}

function headingBase(heading: string): string {
  return heading.replace(/（续\d+）$/, '');
}

function scoreChunk(
  chunk: IndexedChunk,
  keywords: string[],
  topic: RagTopic,
): { score: number; matchedKeywords: string[] } {
  let score = 0;
  const matchedKeywords: string[] = [];

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    let keywordScore = 0;
    if (chunk.normalizedHeading === normalizedKeyword) {
      keywordScore += 14;
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

  const topicBonusVal = chapterTopicBonus(chunk.heading, topic);
  if (matchedKeywords.length > 0 && topicBonusVal > 0) {
    score += topicBonusVal;
  }

  if (matchedKeywords.length > 0 && topicBonusVal > 0 && /论/.test(chunk.heading)) {
    score += 2;
  }

  score += chapterDenyPenalty(chunk.heading);

  if (chunk.source === 'zipingzhenquan.md') {
    score += 1;
  }

  if (chunk.text.length < 80) {
    score -= 4;
  }

  return { score, matchedKeywords };
}

function applyDiversityControls(sorted: BookRagSnippet[], topK: number): BookRagSnippet[] {
  const result: BookRagSnippet[] = [];
  const sourceCount = new Map<string, number>();
  const headingCount = new Map<string, number>();
  const seenTexts = new Set<string>();

  const SOURCE_CAP = 3;
  const HEADING_CAP = 2;

  for (const item of sorted) {
    const textKey = normalizeText(item.text);
    if (seenTexts.has(textKey)) {
      continue;
    }

    const sc = sourceCount.get(item.source) ?? 0;
    if (sc >= SOURCE_CAP) {
      continue;
    }

    const hBase = headingBase(item.heading);
    const hc = headingCount.get(hBase) ?? 0;
    if (hc >= HEADING_CAP) {
      continue;
    }

    seenTexts.add(textKey);
    sourceCount.set(item.source, sc + 1);
    headingCount.set(hBase, hc + 1);
    result.push(item);

    if (result.length >= topK) {
      break;
    }
  }

  return result;
}

export async function retrieveBookRagSnippets(params: {
  booksPath: string;
  queryText: string;
  topK: number;
  minScore?: number;
  topic?: RagTopic;
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

  const topic = params.topic ?? 'general';
  const minScore = params.minScore ?? 7;

  const scored: BookRagSnippet[] = [];
  for (const ch of index.chunks) {
    const { score, matchedKeywords } = scoreChunk(ch, keywords, topic);
    if (score < minScore) {
      continue;
    }
    if (matchedKeywords.length === 1 && matchedKeywords[0]!.length === 1) {
      const kw = matchedKeywords[0]!;
      const normalizedKw = normalizeText(kw);
      if (ch.normalizedHeading !== normalizedKw) {
        continue;
      }
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

  const k = Math.max(1, Math.min(params.topK, 20));
  return applyDiversityControls(scored, k);
}
