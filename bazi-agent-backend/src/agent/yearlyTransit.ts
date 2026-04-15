/**
 * Deterministic yearly transit (流年) computation using the 60 Jiazi cycle.
 * No MCP or network calls required — pure arithmetic over the sexagenary cycle.
 */

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const STEM_ELEMENT: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

const BRANCH_ELEMENT: Record<string, string> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

/** 六合 pairs (stem index based) */
const STEM_COMBINE: Record<string, string> = {
  甲己: '合', 乙庚: '合', 丙辛: '合', 丁壬: '合', 戊癸: '合',
};

/** 天干冲 (separated by 6 in 10-stem cycle, i.e. index diff = 4 on the opposite axis) */
const STEM_CLASH: Record<string, string> = {
  甲庚: '冲', 乙辛: '冲', 丙壬: '冲', 丁癸: '冲',
};

/** 地支六冲 */
const BRANCH_CLASH_PAIRS = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];

/** 地支六合 */
const BRANCH_COMBINE_PAIRS = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];

/** 地支相刑 (simplified primary relationships) */
const BRANCH_HARM_PAIRS = ['子卯', '寅巳', '丑戌', '戌未'];

function stemIndex(stem: string): number {
  return STEMS.indexOf(stem as typeof STEMS[number]);
}

function branchIndex(branch: string): number {
  return BRANCHES.indexOf(branch as typeof BRANCHES[number]);
}

function yearToGanZhi(year: number): { stem: string; branch: string; ganZhi: string } {
  const stemIdx = ((year - 4) % 10 + 10) % 10;
  const branchIdx = ((year - 4) % 12 + 12) % 12;
  const stem = STEMS[stemIdx] ?? '甲';
  const branch = BRANCHES[branchIdx] ?? '子';
  return { stem, branch, ganZhi: `${stem}${branch}` };
}

export interface NatalInteraction {
  type: '合' | '冲' | '刑' | '克';
  scope: '天干' | '地支';
  target: string;
  description: string;
}

function detectStemInteractions(transitStem: string, natalStems: Array<{ pillar: string; stem: string }>): NatalInteraction[] {
  const results: NatalInteraction[] = [];
  for (const { pillar, stem } of natalStems) {
    const pair = `${transitStem}${stem}`;
    const pairReverse = `${stem}${transitStem}`;
    if (STEM_COMBINE[pair] || STEM_COMBINE[pairReverse]) {
      results.push({ type: '合', scope: '天干', target: pillar, description: `流年${transitStem}合${pillar}${stem}` });
    }
    if (STEM_CLASH[pair] || STEM_CLASH[pairReverse]) {
      results.push({ type: '冲', scope: '天干', target: pillar, description: `流年${transitStem}冲${pillar}${stem}` });
    }
    const tEl = STEM_ELEMENT[transitStem];
    const nEl = STEM_ELEMENT[stem];
    if (tEl && nEl && isOvercoming(tEl, nEl)) {
      results.push({ type: '克', scope: '天干', target: pillar, description: `流年${transitStem}(${tEl})克${pillar}${stem}(${nEl})` });
    }
  }
  return results;
}

function detectBranchInteractions(transitBranch: string, natalBranches: Array<{ pillar: string; branch: string }>): NatalInteraction[] {
  const results: NatalInteraction[] = [];
  for (const { pillar, branch } of natalBranches) {
    const pair = `${transitBranch}${branch}`;
    const pairReverse = `${branch}${transitBranch}`;
    if (BRANCH_CLASH_PAIRS.includes(pair) || BRANCH_CLASH_PAIRS.includes(pairReverse)) {
      results.push({ type: '冲', scope: '地支', target: pillar, description: `流年${transitBranch}冲${pillar}${branch}` });
    }
    if (BRANCH_COMBINE_PAIRS.includes(pair) || BRANCH_COMBINE_PAIRS.includes(pairReverse)) {
      results.push({ type: '合', scope: '地支', target: pillar, description: `流年${transitBranch}合${pillar}${branch}` });
    }
    if (BRANCH_HARM_PAIRS.includes(pair) || BRANCH_HARM_PAIRS.includes(pairReverse)) {
      results.push({ type: '刑', scope: '地支', target: pillar, description: `流年${transitBranch}刑${pillar}${branch}` });
    }
  }
  return results;
}

const OVERCOME_MAP: Record<string, string> = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' };
function isOvercoming(attacker: string, target: string): boolean {
  return OVERCOME_MAP[attacker] === target;
}

export interface FortuneDecade {
  ganZhi: string | null;
  startYear: number | null;
  endYear: number | null;
  startAge: number | null;
  endAge: number | null;
}

export interface YearTransitEntry {
  year: number;
  ganZhi: string;
  stem: string;
  branch: string;
  stemElement: string;
  branchElement: string;
  daYunGanZhi: string | null;
  interactions: NatalInteraction[];
}

function extractNatalPillars(chartRich: Record<string, unknown> | null): {
  stems: Array<{ pillar: string; stem: string }>;
  branches: Array<{ pillar: string; branch: string }>;
} {
  const stems: Array<{ pillar: string; stem: string }> = [];
  const branches: Array<{ pillar: string; branch: string }> = [];

  if (!chartRich) return { stems, branches };

  const pillars = chartRich['pillars'] as Record<string, unknown> | undefined;
  if (!pillars || typeof pillars !== 'object') return { stems, branches };

  const PILLAR_NAMES: Record<string, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };

  for (const [key, label] of Object.entries(PILLAR_NAMES)) {
    const pillar = pillars[key] as Record<string, unknown> | undefined;
    if (!pillar || typeof pillar !== 'object') continue;
    const stemObj = pillar['stem'] as Record<string, unknown> | undefined;
    const branchObj = pillar['branch'] as Record<string, unknown> | undefined;
    const stemText = typeof stemObj?.['text'] === 'string' ? stemObj['text'] : null;
    const branchText = typeof branchObj?.['text'] === 'string' ? branchObj['text'] : null;
    if (stemText && stemIndex(stemText) >= 0) {
      stems.push({ pillar: label, stem: stemText });
    }
    if (branchText && branchIndex(branchText) >= 0) {
      branches.push({ pillar: label, branch: branchText });
    }
  }

  return { stems, branches };
}

function matchDaYun(year: number, decades: FortuneDecade[]): string | null {
  for (const d of decades) {
    if (d.startYear !== null && d.endYear !== null && year >= d.startYear && year <= d.endYear) {
      return d.ganZhi;
    }
  }
  return null;
}

function extractFortuneDecades(chartRich: Record<string, unknown> | null): FortuneDecade[] {
  if (!chartRich) return [];
  const fortune = chartRich['fortune'] as Record<string, unknown> | undefined;
  if (!fortune || typeof fortune !== 'object') return [];
  const decades = fortune['decades'];
  if (!Array.isArray(decades)) return [];

  return decades
    .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
    .map((d) => ({
      ganZhi: typeof d['ganZhi'] === 'string' ? d['ganZhi'] : null,
      startYear: typeof d['startYear'] === 'number' ? d['startYear'] : null,
      endYear: typeof d['endYear'] === 'number' ? d['endYear'] : null,
      startAge: typeof d['startAge'] === 'number' ? d['startAge'] : null,
      endAge: typeof d['endAge'] === 'number' ? d['endAge'] : null,
    }));
}

export function computeYearlyTransits(params: {
  yearStart: number;
  yearEnd: number;
  chartRich: Record<string, unknown> | null;
}): YearTransitEntry[] {
  const { yearStart, yearEnd, chartRich } = params;
  const { stems: natalStems, branches: natalBranches } = extractNatalPillars(chartRich);
  const decades = extractFortuneDecades(chartRich);
  const entries: YearTransitEntry[] = [];

  for (let year = yearStart; year <= yearEnd; year++) {
    const { stem, branch, ganZhi } = yearToGanZhi(year);
    const interactions = [
      ...detectStemInteractions(stem, natalStems),
      ...detectBranchInteractions(branch, natalBranches),
    ];

    entries.push({
      year,
      ganZhi,
      stem,
      branch,
      stemElement: STEM_ELEMENT[stem] ?? '未知',
      branchElement: BRANCH_ELEMENT[branch] ?? '未知',
      daYunGanZhi: matchDaYun(year, decades),
      interactions,
    });
  }

  return entries;
}

/**
 * Pick key years for prediction: current year, next year, and
 * 大运 transition years (first year of each decade within a window).
 * Returns a de-duplicated, sorted list capped at `maxYears`.
 */
export function pickKeyYears(params: {
  currentYear: number;
  chartRich: Record<string, unknown> | null;
  windowYears?: number;
  maxYears?: number;
}): number[] {
  const { currentYear, chartRich, windowYears = 15, maxYears = 6 } = params;
  const decades = extractFortuneDecades(chartRich);
  const yearSet = new Set<number>();

  yearSet.add(currentYear);
  yearSet.add(currentYear + 1);

  for (const d of decades) {
    if (d.startYear !== null && d.startYear > currentYear && d.startYear <= currentYear + windowYears) {
      yearSet.add(d.startYear);
    }
  }

  const sorted = [...yearSet].sort((a, b) => a - b);
  return sorted.slice(0, maxYears);
}
