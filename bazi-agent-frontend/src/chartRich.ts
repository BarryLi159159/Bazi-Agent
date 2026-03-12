type UnknownRecord = Record<string, unknown>;

export interface NormalizedPillar {
  key: string;
  label: string;
  stem: string;
  stemElement: string;
  stemYinYang: string;
  stemTenGod: string;
  branch: string;
  branchElement: string;
  branchYinYang: string;
  hiddenStems: Array<{ slot: string; stem: string; tenGod: string }>;
  naYin: string;
  xun: string;
  kongWang: string;
  xingYun: string;
  ziZuo: string;
}

export interface NormalizedFiveElements {
  metal: number | null;
  wood: number | null;
  water: number | null;
  fire: number | null;
  earth: number | null;
  strength: number | null;
  median: number | null;
  strongRoot: string;
  method: string;
}

export interface NormalizedFortuneDecade {
  ganZhi: string;
  startYear: number | null;
  endYear: number | null;
  startAge: number | null;
  endAge: number | null;
  cycleState: string;
  naYin: string;
  detail: string;
  stemTenGod: string;
  branchTenGods: string[];
  hiddenStems: string[];
}

export interface NormalizedChartRich {
  source: string;
  basic: {
    gender: string;
    solar: string;
    lunar: string;
    bazi: string;
    zodiac: string;
    dayMaster: string;
    taiYuan: string;
    taiXi: string;
    mingGong: string;
    shenGong: string;
  };
  pillars: NormalizedPillar[];
  fiveElements: NormalizedFiveElements;
  fortune: {
    startDate: string;
    startAge: number | null;
    list: string[];
    decades: NormalizedFortuneDecade[];
  };
  gods: {
    year: string[];
    month: string[];
    day: string[];
    hour: string[];
  };
  relations: {
    raw: string;
    highlights: string[];
  };
  rawText: string;
  parser: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function asString(value: unknown, fallback = '-'): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asNumber(value: unknown): number | null {
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function parseHiddenStems(value: unknown): Array<{ slot: string; stem: string; tenGod: string }> {
  const fromArray = Array.isArray(value)
    ? value
        .map((item) => {
          const r = asRecord(item);
          if (!r) return null;
          return {
            slot: asString(r['slot'], ''),
            stem: asString(r['stem'], ''),
            tenGod: asString(r['tenGod'], ''),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && item.stem.length > 0)
    : [];
  if (fromArray.length > 0) {
    return fromArray;
  }

  const hidden = asRecord(value);
  if (!hidden) {
    return [];
  }

  return (['主气', '中气', '余气'] as const)
    .map((slot) => {
      const item = asRecord(hidden[slot]);
      if (!item) {
        return null;
      }
      const stem = asString(item['天干'], '');
      if (!stem) {
        return null;
      }
      return {
        slot,
        stem,
        tenGod: asString(item['十神'], ''),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function parsePillarFromChart(slot: string, label: string, value: unknown): NormalizedPillar {
  const record = asRecord(value);
  const stem = asRecord(record?.['stem']);
  const branch = asRecord(record?.['branch']);

  if (record && stem && branch) {
    return {
      key: slot,
      label,
      stem: asString(stem['text']),
      stemElement: asString(stem['element']),
      stemYinYang: asString(stem['yinYang']),
      stemTenGod: asString(stem['tenGod']),
      branch: asString(branch['text']),
      branchElement: asString(branch['element']),
      branchYinYang: asString(branch['yinYang']),
      hiddenStems: parseHiddenStems(branch['hiddenStems']),
      naYin: asString(record['naYin']),
      xun: asString(record['xun']),
      kongWang: asString(record['kongWang']),
      xingYun: asString(record['xingYun']),
      ziZuo: asString(record['ziZuo']),
    };
  }

  const legacyStem = asRecord(record?.['天干']);
  const legacyBranch = asRecord(record?.['地支']);
  return {
    key: slot,
    label,
    stem: asString(legacyStem?.['天干']),
    stemElement: asString(legacyStem?.['五行']),
    stemYinYang: asString(legacyStem?.['阴阳']),
    stemTenGod: asString(legacyStem?.['十神']),
    branch: asString(legacyBranch?.['地支']),
    branchElement: asString(legacyBranch?.['五行']),
    branchYinYang: asString(legacyBranch?.['阴阳']),
    hiddenStems: parseHiddenStems(legacyBranch?.['藏干']),
    naYin: asString(record?.['纳音']),
    xun: asString(record?.['旬']),
    kongWang: asString(record?.['空亡']),
    xingYun: asString(record?.['星运']),
    ziZuo: asString(record?.['自坐']),
  };
}

function parseFortuneDecades(value: unknown): NormalizedFortuneDecade[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      return {
        ganZhi: asString(record['ganZhi'] ?? record['干支']),
        startYear: asNumber(record['startYear'] ?? record['开始年份']),
        endYear: asNumber(record['endYear'] ?? record['结束'] ?? record['结束年份']),
        startAge: asNumber(record['startAge'] ?? record['开始年龄']),
        endAge: asNumber(record['endAge'] ?? record['结束年龄']),
        cycleState: asString(record['cycleState'] ?? record['十二运']),
        naYin: asString(record['naYin'] ?? record['纳音']),
        detail: asString(record['detail'] ?? record['详情']),
        stemTenGod: asString(record['stemTenGod'] ?? record['天干十神']),
        branchTenGods: asStringArray(record['branchTenGods'] ?? record['地支十神']),
        hiddenStems: asStringArray(record['hiddenStems'] ?? record['地支藏干']),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function parseRelationHighlights(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return '';
      }
      const text = asString(record['text'] ?? record['知识点'], '');
      if (!text) {
        return '';
      }
      const pillar = asString(record['pillar'] ?? record['柱'], '');
      const scope = asString(record['scope'], '');
      const kind = asString(record['kind'], '');
      const target = asString(record['target'], '');
      return [pillar ? `${pillar}柱` : '', scope, kind, text, target ? `→${target}柱` : ''].filter(Boolean).join(' · ');
    })
    .filter((item) => item.length > 0);
}

export function normalizeChartRich(bazi: Record<string, unknown> | null): NormalizedChartRich | null {
  if (!bazi) {
    return null;
  }

  const chart = asRecord(bazi['chart_rich']);
  const basicFromChart = asRecord(chart?.['basic']);
  const pillarsFromChart = asRecord(chart?.['pillars']);
  const fiveFromChart = asRecord(chart?.['fiveElements']);
  const fortuneFromChart = asRecord(chart?.['fortune']);
  const godsFromChart = asRecord(chart?.['gods']);
  const relationsFromChart = asRecord(chart?.['relations']);
  const rawFromChart = asRecord(chart?.['raw']);

  const pillars: NormalizedPillar[] = [
    parsePillarFromChart('year', '年柱', pillarsFromChart?.['year'] ?? bazi['年柱']),
    parsePillarFromChart('month', '月柱', pillarsFromChart?.['month'] ?? bazi['月柱']),
    parsePillarFromChart('day', '日柱', pillarsFromChart?.['day'] ?? bazi['日柱']),
    parsePillarFromChart('hour', '时柱', pillarsFromChart?.['hour'] ?? bazi['时柱']),
  ];

  const fiveLegacy = asRecord(bazi['五行统计']);
  const fortunesLegacy = asRecord(bazi['大运']);
  const godsLegacy = asRecord(bazi['神煞']);
  const relationLegacy = bazi['刑冲合会'];

  const fiveElements: NormalizedFiveElements = {
    metal: asNumber(fiveFromChart?.['metal'] ?? fiveLegacy?.['金']),
    wood: asNumber(fiveFromChart?.['wood'] ?? fiveLegacy?.['木']),
    water: asNumber(fiveFromChart?.['water'] ?? fiveLegacy?.['水']),
    fire: asNumber(fiveFromChart?.['fire'] ?? fiveLegacy?.['火']),
    earth: asNumber(fiveFromChart?.['earth'] ?? fiveLegacy?.['土']),
    strength: asNumber(fiveFromChart?.['strength'] ?? fiveLegacy?.['强弱']),
    median: asNumber(fiveFromChart?.['median'] ?? fiveLegacy?.['中值']),
    strongRoot: asString(fiveFromChart?.['strongRoot'] ?? fiveLegacy?.['强根']),
    method: asString(fiveFromChart?.['method'], fiveFromChart ? 'provider' : 'legacy'),
  };

  const decades = parseFortuneDecades(
    fortuneFromChart?.['decades'] ?? fortuneFromChart?.['大运'] ?? fortunesLegacy?.['大运'] ?? fortunesLegacy?.['详情'],
  );
  const list = asStringArray(fortuneFromChart?.['list'] ?? fortunesLegacy?.['列表']);

  const highlights = parseRelationHighlights(relationsFromChart?.['highlights']);
  const relationRawRecord = asRecord(relationsFromChart?.['raw']);
  const relationRaw = relationRawRecord ?? relationLegacy ?? {};

  return {
    source: asString(chart?.['source'] ?? bazi['来源'] ?? bazi['provider'], 'unknown'),
    basic: {
      gender: asString(basicFromChart?.['gender'] ?? bazi['性别']),
      solar: asString(basicFromChart?.['solar'] ?? bazi['阳历']),
      lunar: asString(basicFromChart?.['lunar'] ?? bazi['农历']),
      bazi: asString(basicFromChart?.['bazi'] ?? bazi['八字']),
      zodiac: asString(basicFromChart?.['zodiac'] ?? bazi['生肖']),
      dayMaster: asString(basicFromChart?.['dayMaster'] ?? bazi['日主']),
      taiYuan: asString(basicFromChart?.['taiYuan'] ?? bazi['胎元']),
      taiXi: asString(basicFromChart?.['taiXi'] ?? bazi['胎息']),
      mingGong: asString(basicFromChart?.['mingGong'] ?? bazi['命宫']),
      shenGong: asString(basicFromChart?.['shenGong'] ?? bazi['身宫']),
    },
    pillars,
    fiveElements,
    fortune: {
      startDate: asString(fortuneFromChart?.['startDate'] ?? fortunesLegacy?.['起运日期']),
      startAge: asNumber(fortuneFromChart?.['startAge'] ?? fortunesLegacy?.['起运年龄']),
      list: list.length > 0 ? list : decades.map((item) => item.ganZhi).filter((item) => item !== '-'),
      decades,
    },
    gods: {
      year: asStringArray(godsFromChart?.['year'] ?? godsLegacy?.['年柱']),
      month: asStringArray(godsFromChart?.['month'] ?? godsLegacy?.['月柱']),
      day: asStringArray(godsFromChart?.['day'] ?? godsLegacy?.['日柱']),
      hour: asStringArray(godsFromChart?.['hour'] ?? godsLegacy?.['时柱']),
    },
    relations: {
      raw: JSON.stringify(relationRaw, null, 2),
      highlights,
    },
    rawText: asString(rawFromChart?.['text'] ?? bazi['原始文本'], ''),
    parser: asString(rawFromChart?.['parser'] ?? asRecord(bazi['解析信息'])?.['parser'], ''),
  };
}
