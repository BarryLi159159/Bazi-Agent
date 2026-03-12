type UnknownRecord = Record<string, unknown>;

type RelationHighlight = {
  pillar: string;
  scope: string;
  kind: string;
  text: string;
  element: string | null;
  target: string | null;
};

const STEM_TO_ELEMENT: Record<string, string> = {
  甲: '木',
  乙: '木',
  丙: '火',
  丁: '火',
  戊: '土',
  己: '土',
  庚: '金',
  辛: '金',
  壬: '水',
  癸: '水',
};


function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isPlaceholderText(value: string | null): boolean {
  if (value === null) {
    return true;
  }
  const normalized = value.replace(/\s+/g, '');
  return normalized === '-' || normalized === '--' || normalized === '—' || normalized === '——' || normalized === '暂无' || normalized === '未知';
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => toStringValue(item))
    .filter((item): item is string => item !== null);
}


function pickString(record: UnknownRecord, key: string): string | null {
  return toStringValue(record[key]);
}

function pickNumber(record: UnknownRecord, key: string): number | null {
  return toNumberValue(record[key]);
}

function normalizeHiddenStems(value: unknown): Array<{ slot: string; stem: string; tenGod: string | null }> {
  if (!isRecord(value)) {
    return [];
  }

  const slots = ['主气', '中气', '余气'];
  const result: Array<{ slot: string; stem: string; tenGod: string | null }> = [];

  for (const slot of slots) {
    const item = value[slot];
    if (!isRecord(item)) {
      continue;
    }
    const stem = pickString(item, '天干');
    if (!stem) {
      continue;
    }
    result.push({
      slot,
      stem,
      tenGod: pickString(item, '十神'),
    });
  }

  return result;
}

function normalizePillar(value: unknown) {
  const empty = {
    stem: {
      text: null as string | null,
      element: null as string | null,
      yinYang: null as string | null,
      tenGod: null as string | null,
    },
    branch: {
      text: null as string | null,
      element: null as string | null,
      yinYang: null as string | null,
      hiddenStems: [] as Array<{ slot: string; stem: string; tenGod: string | null }>,
    },
    naYin: null as string | null,
    xun: null as string | null,
    kongWang: null as string | null,
    xingYun: null as string | null,
    ziZuo: null as string | null,
  };

  if (!isRecord(value)) {
    return empty;
  }

  const stem = isRecord(value['天干']) ? value['天干'] : {};
  const branch = isRecord(value['地支']) ? value['地支'] : {};

  return {
    stem: {
      text: pickString(stem, '天干'),
      element: pickString(stem, '五行'),
      yinYang: pickString(stem, '阴阳'),
      tenGod: pickString(stem, '十神'),
    },
    branch: {
      text: pickString(branch, '地支'),
      element: pickString(branch, '五行'),
      yinYang: pickString(branch, '阴阳'),
      hiddenStems: normalizeHiddenStems(branch['藏干']),
    },
    naYin: pickString(value, '纳音'),
    xun: pickString(value, '旬'),
    kongWang: pickString(value, '空亡'),
    xingYun: pickString(value, '星运'),
    ziZuo: pickString(value, '自坐'),
  };
}

function deriveFiveElementsFromPillars(pillars: UnknownRecord) {
  const counts: Record<string, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
  const slots = ['year', 'month', 'day', 'hour'] as const;

  for (const slot of slots) {
    const pillar = pillars[slot];
    if (!isRecord(pillar)) {
      continue;
    }
    const stem = isRecord(pillar['stem']) ? pillar['stem'] : null;
    const branch = isRecord(pillar['branch']) ? pillar['branch'] : null;
    const stemElement = toStringValue(stem?.['element']);
    const branchElement = toStringValue(branch?.['element']);
    if (stemElement && counts[stemElement] !== undefined) {
      counts[stemElement] += 1;
    }
    if (branchElement && counts[branchElement] !== undefined) {
      counts[branchElement] += 1;
    }
    const hidden = Array.isArray(branch?.['hiddenStems']) ? branch?.['hiddenStems'] : [];
    for (const item of hidden) {
      if (!isRecord(item)) {
        continue;
      }
      const stem = toStringValue(item['stem']);
      const element = stem ? STEM_TO_ELEMENT[stem] : undefined;
      if (element && counts[element] !== undefined) {
        counts[element] += 1;
      }
    }
  }

  return counts;
}

function normalizeFiveElements(record: UnknownRecord, pillars: UnknownRecord) {
  const fromProvider = isRecord(record['五行统计']) ? record['五行统计'] : null;

  if (fromProvider) {
    return {
      metal: pickNumber(fromProvider, '金'),
      wood: pickNumber(fromProvider, '木'),
      water: pickNumber(fromProvider, '水'),
      fire: pickNumber(fromProvider, '火'),
      earth: pickNumber(fromProvider, '土'),
      strength: pickNumber(fromProvider, '强弱'),
      median: pickNumber(fromProvider, '中值'),
      strongRoot: pickString(fromProvider, '强根'),
      method: 'provider',
    };
  }

  const derived = deriveFiveElementsFromPillars(pillars);
  return {
    metal: derived['金'],
    wood: derived['木'],
    water: derived['水'],
    fire: derived['火'],
    earth: derived['土'],
    strength: null,
    median: null,
    strongRoot: null,
    method: 'derived',
  };
}

function normalizeFortune(value: unknown) {
  const input = isRecord(value) ? value : {};
  const inputList = toStringArray(input['列表']);

  const decadesSource = Array.isArray(input['大运']) ? input['大运'] : Array.isArray(input['详情']) ? input['详情'] : [];

  const decades = decadesSource
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const branchTenGods = toStringArray(item['地支十神']);
      const hiddenStems = toStringArray(item['地支藏干']);
      return {
        ganZhi: pickString(item, '干支'),
        startYear: pickNumber(item, '开始年份'),
        endYear: pickNumber(item, '结束') ?? pickNumber(item, '结束年份'),
        startAge: pickNumber(item, '开始年龄'),
        endAge: pickNumber(item, '结束年龄'),
        cycleState: pickString(item, '十二运'),
        naYin: pickString(item, '纳音'),
        detail: pickString(item, '详情'),
        stemTenGod: pickString(item, '天干十神'),
        branchTenGods,
        hiddenStems,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const list = inputList.length > 0 ? inputList : decades.map((item) => item.ganZhi).filter((item): item is string => Boolean(item));

  return {
    startDate: pickString(input, '起运日期'),
    startAge: pickNumber(input, '起运年龄'),
    list,
    decades,
  };
}

function normalizeGods(value: unknown) {
  const input = isRecord(value) ? value : {};
  return {
    year: toStringArray(input['年柱']),
    month: toStringArray(input['月柱']),
    day: toStringArray(input['日柱']),
    hour: toStringArray(input['时柱']),
  };
}

function extractRelationHighlights(value: unknown): RelationHighlight[] {
  if (!isRecord(value)) {
    return [];
  }

  const result: RelationHighlight[] = [];
  const pillarNames = ['年', '月', '日', '时'];

  for (const pillar of pillarNames) {
    const pillarValue = value[pillar];
    if (!isRecord(pillarValue)) {
      continue;
    }

    const scopes = ['天干', '地支'];
    for (const scope of scopes) {
      const scopeValue = pillarValue[scope];
      if (!isRecord(scopeValue)) {
        continue;
      }

      for (const [kind, details] of Object.entries(scopeValue)) {
        if (!Array.isArray(details)) {
          continue;
        }
        for (const detailItem of details) {
          if (!isRecord(detailItem)) {
            continue;
          }
          const text = pickString(detailItem, '知识点');
          if (!text) {
            continue;
          }
          result.push({
            pillar,
            scope,
            kind,
            text,
            element: pickString(detailItem, '元素'),
            target: pickString(detailItem, '柱'),
          });
        }
      }
    }
  }

  return result;
}

function normalizeRelation(value: unknown) {
  const relation = isRecord(value) ? value : {};
  return {
    raw: relation,
    highlights: extractRelationHighlights(relation),
  };
}

function buildSource(raw: UnknownRecord, sourceHint?: string): string {
  const fromRaw = pickString(raw, '来源');
  if (fromRaw) {
    return fromRaw;
  }

  if (sourceHint?.includes('mcp')) {
    return 'bazi-mcp';
  }
  if (sourceHint?.includes('python') || sourceHint?.includes('master')) {
    return 'bazi-master';
  }
  return sourceHint ?? 'unknown';
}

function buildLegacyFiveElements(fiveElements: {
  metal: unknown;
  wood: unknown;
  water: unknown;
  fire: unknown;
  earth: unknown;
  strength: unknown;
  median: unknown;
  strongRoot: unknown;
}): UnknownRecord {
  return {
    金: fiveElements['metal'],
    木: fiveElements['wood'],
    水: fiveElements['water'],
    火: fiveElements['fire'],
    土: fiveElements['earth'],
    强弱: fiveElements['strength'],
    中值: fiveElements['median'],
    强根: fiveElements['strongRoot'],
  };
}

export function hasChartRich(record: unknown): boolean {
  if (!isRecord(record)) {
    return false;
  }
  const chart = record['chart_rich'];
  if (!isRecord(chart)) {
    return false;
  }
  return toStringValue(chart['schema']) === 'chart_rich_v1';
}

export function hasMissingFortuneCycles(record: unknown): boolean {
  if (!hasChartRich(record)) {
    return true;
  }
  if (!isRecord(record)) {
    return true;
  }
  const chart = record['chart_rich'];
  if (!isRecord(chart)) {
    return true;
  }
  const fortune = chart['fortune'];
  if (!isRecord(fortune)) {
    return true;
  }
  const decades = fortune['decades'];
  if (!Array.isArray(decades) || decades.length === 0) {
    return true;
  }
  return decades.some((item) => {
    if (!isRecord(item)) {
      return true;
    }
    return isPlaceholderText(toStringValue(item['cycleState']));
  });
}

export function mergeFortuneFromSupplement(baseValue: unknown, supplementValue: unknown): unknown {
  if (!isRecord(baseValue) || !isRecord(supplementValue)) {
    return baseValue;
  }

  const baseChart = isRecord(baseValue['chart_rich']) ? baseValue['chart_rich'] : null;
  const supplementChart = isRecord(supplementValue['chart_rich']) ? supplementValue['chart_rich'] : null;
  if (!baseChart || !supplementChart) {
    return baseValue;
  }

  const baseFortune = isRecord(baseChart['fortune']) ? baseChart['fortune'] : null;
  const supplementFortune = isRecord(supplementChart['fortune']) ? supplementChart['fortune'] : null;
  if (!baseFortune || !supplementFortune) {
    return baseValue;
  }

  const baseDecades = Array.isArray(baseFortune['decades']) ? baseFortune['decades'] : [];
  const supplementDecades = Array.isArray(supplementFortune['decades']) ? supplementFortune['decades'] : [];
  if (baseDecades.length === 0 || supplementDecades.length === 0) {
    return baseValue;
  }

  const indexByKey = new Map<string, UnknownRecord>();
  for (const item of supplementDecades) {
    if (!isRecord(item)) {
      continue;
    }
    const ganZhi = toStringValue(item['ganZhi']) ?? '';
    const startAge = toNumberValue(item['startAge']);
    const startYear = toNumberValue(item['startYear']);
    const keys = [ganZhi, startAge !== null ? `${ganZhi}#age:${startAge}` : '', startYear !== null ? `${ganZhi}#year:${startYear}` : ''];
    for (const key of keys) {
      if (key) {
        indexByKey.set(key, item);
      }
    }
  }

  const mergedDecades = baseDecades.map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    const ganZhi = toStringValue(item['ganZhi']) ?? '';
    const startAge = toNumberValue(item['startAge']);
    const startYear = toNumberValue(item['startYear']);
    const keys = [ganZhi, startAge !== null ? `${ganZhi}#age:${startAge}` : '', startYear !== null ? `${ganZhi}#year:${startYear}` : ''];
    const supplement = keys.map((k) => (k ? indexByKey.get(k) : undefined)).find((v) => v !== undefined);
    if (!supplement) {
      return item;
    }

    const baseCycleState = toStringValue(item['cycleState']);
    const baseNaYin = toStringValue(item['naYin']);
    const cycleState = isPlaceholderText(baseCycleState) ? toStringValue(supplement['cycleState']) : baseCycleState;
    const naYin = isPlaceholderText(baseNaYin) ? toStringValue(supplement['naYin']) : baseNaYin;
    return {
      ...item,
      cycleState,
      naYin,
    };
  });

  const mergedChart = {
    ...baseChart,
    fortune: {
      ...baseFortune,
      decades: mergedDecades,
    },
  };

  return {
    ...baseValue,
    chart_rich: mergedChart,
  };
}

export function normalizeBaziRecord(rawValue: unknown, sourceHint?: string): unknown {
  if (!isRecord(rawValue)) {
    return rawValue;
  }

  const raw = { ...rawValue };
  const source = buildSource(raw, sourceHint);

  const pillars = {
    year: normalizePillar(raw['年柱']),
    month: normalizePillar(raw['月柱']),
    day: normalizePillar(raw['日柱']),
    hour: normalizePillar(raw['时柱']),
  };

  const pillarsRecord: UnknownRecord = {
    year: pillars.year,
    month: pillars.month,
    day: pillars.day,
    hour: pillars.hour,
  };

  const fiveElements = normalizeFiveElements(raw, pillarsRecord);
  const fortune = normalizeFortune(raw['大运']);
  const gods = normalizeGods(raw['神煞']);
  const relations = normalizeRelation(raw['刑冲合会']);

  const chartRich = {
    schema: 'chart_rich_v1',
    source,
    provider: sourceHint ?? null,
    generatedAt: new Date().toISOString(),
    basic: {
      gender: pickString(raw, '性别'),
      solar: pickString(raw, '阳历'),
      lunar: pickString(raw, '农历'),
      bazi: pickString(raw, '八字'),
      zodiac: pickString(raw, '生肖'),
      dayMaster: pickString(raw, '日主'),
      taiYuan: pickString(raw, '胎元'),
      taiXi: pickString(raw, '胎息'),
      mingGong: pickString(raw, '命宫'),
      shenGong: pickString(raw, '身宫'),
    },
    pillars,
    fiveElements,
    fortune,
    gods,
    relations,
    raw: {
      text: pickString(raw, '原始文本'),
      parser: isRecord(raw['解析信息']) ? pickString(raw['解析信息'], 'parser') : null,
    },
  };

  const merged: UnknownRecord = {
    ...raw,
    来源: source,
    provider: pickString(raw, 'provider') ?? sourceHint ?? null,
    chart_rich: chartRich,
  };

  if (!isRecord(merged['五行统计'])) {
    merged['五行统计'] = buildLegacyFiveElements(fiveElements);
  }

  return merged;
}
