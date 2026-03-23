/** 从 users.bazi_json 抽取展示用八字、生肖（供 API 列表等使用） */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractBaziFromChartRich(chartRich: Record<string, unknown>): string | null {
  const pillars = chartRich['pillars'];
  if (!isRecord(pillars)) {
    return null;
  }
  const slots = ['year', 'month', 'day', 'hour'] as const;
  const parts: string[] = [];
  for (const slot of slots) {
    const pillar = pillars[slot];
    if (!isRecord(pillar)) {
      return null;
    }
    const stem = pillar['stem'];
    const branch = pillar['branch'];
    const stemText = isRecord(stem) ? stem['text'] : null;
    const branchText = isRecord(branch) ? branch['text'] : null;
    if (typeof stemText !== 'string' || typeof branchText !== 'string') {
      return null;
    }
    parts.push(`${stemText}${branchText}`);
  }
  return parts.length === 4 ? parts.join(' ') : null;
}

export function extractBaziSummary(baziJson: unknown): string | null {
  let root: unknown = baziJson;
  if (typeof root === 'string') {
    try {
      root = JSON.parse(root) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(root)) {
    return null;
  }

  const direct = root['八字'];
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const chartRich = root['chart_rich'];
  if (isRecord(chartRich)) {
    const basic = chartRich['basic'];
    if (isRecord(basic) && typeof basic['bazi'] === 'string' && basic['bazi'].trim()) {
      return basic['bazi'].trim();
    }
    const fromPillars = extractBaziFromChartRich(chartRich);
    if (fromPillars) {
      return fromPillars;
    }
  }

  return null;
}

export function extractZodiac(baziJson: unknown): string | null {
  let root: unknown = baziJson;
  if (typeof root === 'string') {
    try {
      root = JSON.parse(root) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(root)) {
    return null;
  }
  const chartRich = root['chart_rich'];
  if (isRecord(chartRich)) {
    const basic = chartRich['basic'];
    if (isRecord(basic) && typeof basic['zodiac'] === 'string') {
      return basic['zodiac'];
    }
  }
  if (typeof root['生肖'] === 'string') {
    return root['生肖'];
  }
  return null;
}
