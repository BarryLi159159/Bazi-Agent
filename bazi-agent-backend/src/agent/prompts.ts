import type { DbMessage, DbUser, DbUserMemory } from '../db/types.js';
import { mapBookSourceToTitle, normalizeBookSectionLabel, type BookRagSnippet } from './rag/bookRag.js';
import type { TransitSnapshot } from './transitService.js';
import type { StructuredAnalysis } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickStringField(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return undefined;
}

function summarizeBazi(bazi: unknown): string {
  if (!bazi) {
    return '暂无八字信息。';
  }

  if (typeof bazi === 'string') {
    return `八字原始信息：${bazi.slice(0, 500)}`;
  }

  if (isRecord(bazi)) {
    const chart = isRecord(bazi['chart_rich']) ? bazi['chart_rich'] : null;
    const basic = isRecord(chart?.['basic']) ? chart?.['basic'] : null;
    const pillars = isRecord(chart?.['pillars']) ? chart?.['pillars'] : null;
    const fiveElements = isRecord(chart?.['fiveElements']) ? chart?.['fiveElements'] : null;
    const fortune = isRecord(chart?.['fortune']) ? chart?.['fortune'] : null;
    const relations = isRecord(chart?.['relations']) ? chart?.['relations'] : null;

    const pillarSummary = pillars
      ? ['year', 'month', 'day', 'hour']
          .map((slot) => {
            const pillar = isRecord(pillars[slot]) ? pillars[slot] : null;
            const stem = isRecord(pillar?.['stem']) ? pillar?.['stem'] : null;
            const branch = isRecord(pillar?.['branch']) ? pillar?.['branch'] : null;
            const text = `${pickStringField(stem ?? {}, 'text') ?? ''}${pickStringField(branch ?? {}, 'text') ?? ''}`.trim();
            return text ? `${slot}:${text}` : '';
          })
          .filter(Boolean)
          .join(' | ')
      : '';

    const fiveElementSummary = fiveElements
      ? ['metal', 'wood', 'water', 'fire', 'earth']
          .map((key) => `${key}:${String(fiveElements[key] ?? '-')}`)
          .join(' | ')
      : '';

    const decades = Array.isArray(fortune?.['decades']) ? fortune?.['decades'] : [];
    const decadeSummary = decades
      .slice(0, 6)
      .map((item) => {
        if (!isRecord(item)) {
          return '';
        }
        const ganZhi = pickStringField(item, 'ganZhi');
        const startAge = item['startAge'];
        const cycleState = pickStringField(item, 'cycleState');
        return [ganZhi, startAge !== undefined && startAge !== null ? `age:${String(startAge)}` : '', cycleState].filter(Boolean).join(' ');
      })
      .filter(Boolean)
      .join(' | ');

    const relationHighlights = Array.isArray(relations?.['highlights'])
      ? relations?.['highlights'].filter((item): item is string => typeof item === 'string').slice(0, 6).join(' | ')
      : '';

    const lines = [
      basic ? `八字：${pickStringField(basic, 'bazi') ?? '未提供'}` : pickStringField(bazi, '八字'),
      basic ? `生肖：${pickStringField(basic, 'zodiac') ?? '未提供'}` : pickStringField(bazi, '生肖'),
      basic ? `日主：${pickStringField(basic, 'dayMaster') ?? '未提供'}` : pickStringField(bazi, '日主'),
      basic ? `出生阳历：${pickStringField(basic, 'solar') ?? '未提供'}` : pickStringField(bazi, '阳历'),
      pillarSummary ? `四柱：${pillarSummary}` : undefined,
      fiveElementSummary ? `五行统计：${fiveElementSummary}` : undefined,
      decadeSummary ? `大运：${decadeSummary}` : undefined,
      relationHighlights ? `刑冲合会：${relationHighlights}` : undefined,
    ].filter((line): line is string => Boolean(line));

    if (lines.length > 0) {
      return lines.join('\n');
    }

    return `八字结构化信息：${JSON.stringify(bazi).slice(0, 1200)}`;
  }

  return `八字信息：${String(bazi)}`;
}

function extractPillarText(pillarValue: unknown): string | null {
  if (!isRecord(pillarValue)) {
    return null;
  }
  const stem = isRecord(pillarValue['stem']) ? pillarValue['stem'] : null;
  const branch = isRecord(pillarValue['branch']) ? pillarValue['branch'] : null;
  const stemText = pickStringField(stem ?? {}, 'text') ?? '';
  const branchText = pickStringField(branch ?? {}, 'text') ?? '';
  const combined = `${stemText}${branchText}`.trim();
  return combined || null;
}

/** 用于典籍 RAG 检索：命盘关键信息 + 用户原话。 */
export function buildBookRagQueryText(bazi: unknown, userMessage: string): string {
  const q = userMessage.trim().slice(0, 600);
  const baziRecord = isRecord(bazi) ? bazi : null;
  const chart = isRecord(baziRecord?.['chart_rich']) ? baziRecord['chart_rich'] : null;
  const basic = isRecord(chart?.['basic']) ? chart['basic'] : null;
  const pillars = isRecord(chart?.['pillars']) ? chart['pillars'] : null;
  const dayMaster = pickStringField(basic ?? {}, 'dayMaster');
  const monthPillar = pillars ? extractPillarText(pillars['month']) : null;

  return [
    q ? `用户问题：${q}` : '',
    dayMaster ? `日主：${dayMaster}` : '',
    monthPillar ? `月柱：${monthPillar}` : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

function summarizeTransit(transit: TransitSnapshot | null | undefined): string {
  if (!transit) {
    return '暂无当前流转信息。';
  }

  const lines = transit.layers.map((layer) => {
    const hidden = layer.hiddenStems.map((item) => `${item.stem}${item.tenGod ? `(${item.tenGod})` : ''}`).join('、') || '无';
    return [
      `${layer.key}: ${layer.ganZhi || '未知'}`,
      `天干=${layer.stem || '未知'} ${layer.stemTenGod || ''}`.trim(),
      `地支=${layer.branch || '未知'}`,
      `藏干=${hidden}`,
      `纳音=${layer.naYin || '未知'}`,
    ].join(' | ');
  });

  return [`生成时间：${transit.generatedAt}`, ...lines].join('\n');
}

function summarizeProfile(profile: Record<string, unknown>): string {
  const birthLocation = pickStringField(profile, 'birthLocation') ?? '未提供';
  const currentAge = typeof profile['currentAge'] === 'number' ? String(profile['currentAge']) : '未提供';
  const currentYear = typeof profile['currentYear'] === 'number' ? String(profile['currentYear']) : '未提供';
  const rawRecords = Array.isArray(profile['chartValidationRecords']) ? profile['chartValidationRecords'] : [];

  const normalizedRecords = rawRecords
    .map((item, index) => {
      if (!isRecord(item)) {
        return '';
      }
      const year = typeof item['year'] === 'number' ? String(item['year']) : '未填';
      const eventType = pickStringField(item, 'eventType') ?? '未填';
      const polarityRaw = pickStringField(item, 'polarity') ?? '未填';
      const polarity = polarityRaw === 'good' ? '偏好' : polarityRaw === 'bad' ? '偏差' : polarityRaw;
      const impact = typeof item['impactLevel'] === 'number' ? String(item['impactLevel']) : '未填';
      return `${index + 1}. 年份:${year} | 事件类型:${eventType} | 好坏:${polarity} | 影响:${impact}`;
    })
    .filter((line) => line.length > 0);

  return [
    `出生地点：${birthLocation}`,
    `当前年龄：${currentAge}`,
    `当前年份：${currentYear}`,
    '命盘校验信息：',
    normalizedRecords.length > 0 ? normalizedRecords.join('\n') : '暂无',
  ].join('\n');
}

function buildSharedContext(params: {
  user: DbUser;
  memories: DbUserMemory[];
  baziData: unknown;
  transitData?: TransitSnapshot | null;
}): string {
  const memoryText =
    params.memories.length === 0
      ? '暂无记忆。'
      : params.memories
          .map((item, index) => `${index + 1}. [${item.memory_type}] ${item.content}`)
          .join('\n');

  const displayName = params.user.display_name ?? '未提供';
  const gender = params.user.gender === 0 ? '女' : params.user.gender === 1 ? '男' : '未提供';
  const profileSummary = summarizeProfile(params.user.profile_json ?? {});

  return [
    '你是一个中文八字咨询助手，语气专业、克制、清晰。',
    '你必须优先基于用户真实问题给出结构化建议，不要空泛。',
    '如果信息不足，先明确缺失信息，再给可执行建议。',
    '健康、法律、财务等高风险场景必须提示用户咨询专业人士。',
    '',
    `用户显示名：${displayName}`,
    `用户性别：${gender}`,
    '',
    '用户补充信息：',
    profileSummary,
    '',
    '用户长期记忆：',
    memoryText,
    '',
    '八字信息：',
    summarizeBazi(params.baziData),
    '',
    '当前流转信息：',
    summarizeTransit(params.transitData),
  ].join('\n');
}

function buildValidationRecords(profile: Record<string, unknown>): Array<Record<string, unknown>> {
  const rawRecords = Array.isArray(profile['chartValidationRecords']) ? profile['chartValidationRecords'] : [];
  const records: Array<Record<string, unknown>> = [];
  for (const item of rawRecords) {
    if (!isRecord(item)) {
      continue;
    }
    records.push({
      year: typeof item['year'] === 'number' ? item['year'] : null,
      eventType: pickStringField(item, 'eventType') ?? null,
      polarity: pickStringField(item, 'polarity') ?? null,
      impactLevel: typeof item['impactLevel'] === 'number' ? item['impactLevel'] : null,
    });
  }
  return records;
}

function buildCompactFortune(fortune: Record<string, unknown> | null, currentAge: number | null): Record<string, unknown> | null {
  if (!fortune) {
    return null;
  }

  const rawDecades = Array.isArray(fortune['decades']) ? fortune['decades'] : [];
  const decades: Array<Record<string, unknown>> = [];
  for (const item of rawDecades) {
    if (!isRecord(item)) {
      continue;
    }
    decades.push({
      ganZhi: pickStringField(item, 'ganZhi') ?? null,
      startAge: typeof item['startAge'] === 'number' ? item['startAge'] : null,
      endAge: typeof item['endAge'] === 'number' ? item['endAge'] : null,
      startYear: typeof item['startYear'] === 'number' ? item['startYear'] : null,
      endYear: typeof item['endYear'] === 'number' ? item['endYear'] : null,
      cycleState: pickStringField(item, 'cycleState') ?? null,
      stemTenGod: pickStringField(item, 'stemTenGod') ?? null,
      branchTenGods: Array.isArray(item['branchTenGods']) ? item['branchTenGods'] : [],
      hiddenStems: Array.isArray(item['hiddenStems']) ? item['hiddenStems'] : [],
    });
    if (decades.length >= 8) {
      break;
    }
  }

  const currentDecade =
    currentAge === null
      ? null
      : decades.find((item) => {
          const startAge = typeof item['startAge'] === 'number' ? item['startAge'] : null;
          const endAge = typeof item['endAge'] === 'number' ? item['endAge'] : null;
          return startAge !== null && endAge !== null && currentAge >= startAge && currentAge <= endAge;
        }) ?? null;

  return {
    startDate: pickStringField(fortune, 'startDate') ?? null,
    startAge: typeof fortune['startAge'] === 'number' ? fortune['startAge'] : null,
    currentDecade,
    decades,
  };
}

export function buildLlmContextJson(params: {
  user: DbUser;
  memories: DbUserMemory[];
  baziData: unknown;
  transitData?: TransitSnapshot | null;
}): Record<string, unknown> {
  const profile = isRecord(params.user.profile_json) ? params.user.profile_json : {};
  const currentAge = typeof profile['currentAge'] === 'number' ? profile['currentAge'] : null;
  const currentYear = typeof profile['currentYear'] === 'number' ? profile['currentYear'] : null;

  const bazi = isRecord(params.baziData) ? params.baziData : null;
  const chart = isRecord(bazi?.['chart_rich']) ? bazi['chart_rich'] : null;
  const basic = isRecord(chart?.['basic']) ? chart['basic'] : null;
  const fiveElements = isRecord(chart?.['fiveElements']) ? chart['fiveElements'] : null;
  const relations = isRecord(chart?.['relations']) ? chart['relations'] : null;
  const fortune = isRecord(chart?.['fortune']) ? chart['fortune'] : null;
  const relationHighlights = Array.isArray(relations?.['highlights']) ? relations['highlights'].slice(0, 8) : [];

  return {
    profile: {
      displayName: params.user.display_name ?? null,
      gender: params.user.gender === 0 ? 'female' : params.user.gender === 1 ? 'male' : null,
      birthSolarDatetime: params.user.birth_solar_datetime ?? null,
      birthLunarDatetime: params.user.birth_lunar_datetime ?? null,
      birthLocation: pickStringField(profile, 'birthLocation') ?? null,
      currentAge,
      currentYear,
      validationRecords: buildValidationRecords(profile),
    },
    memories: params.memories.slice(0, 8).map((item) => ({
      type: item.memory_type,
      content: item.content,
    })),
    natalChart: {
      hasBazi: Boolean(chart || params.baziData),
      source: isRecord(chart) ? (pickStringField(chart, 'source') ?? null) : null,
      basic: basic
        ? {
            bazi: pickStringField(basic, 'bazi') ?? null,
            solar: pickStringField(basic, 'solar') ?? null,
            lunar: pickStringField(basic, 'lunar') ?? null,
            zodiac: pickStringField(basic, 'zodiac') ?? null,
            dayMaster: pickStringField(basic, 'dayMaster') ?? null,
          }
        : null,
      pillars: isRecord(chart?.['pillars']) ? chart['pillars'] : null,
      fiveElements: fiveElements
        ? {
            metal: fiveElements['metal'] ?? null,
            wood: fiveElements['wood'] ?? null,
            water: fiveElements['water'] ?? null,
            fire: fiveElements['fire'] ?? null,
            earth: fiveElements['earth'] ?? null,
            strength: fiveElements['strength'] ?? null,
            strongRoot: fiveElements['strongRoot'] ?? null,
          }
        : null,
      relationHighlights,
    },
    fortune: buildCompactFortune(fortune, currentAge),
    transit: params.transitData
      ? {
          source: params.transitData.source,
          generatedAt: params.transitData.generatedAt,
          layers: params.transitData.layers.map((layer) => ({
            key: layer.key,
            ganZhi: layer.ganZhi,
            stem: layer.stem,
            stemTenGod: layer.stemTenGod,
            branch: layer.branch,
            hiddenStems: layer.hiddenStems,
            naYin: layer.naYin,
            xingYun: layer.xingYun,
          })),
        }
      : null,
  };
}

function formatBookRagSection(snippets: BookRagSnippet[]): string {
  const lines = snippets.map((s, i) => {
    const body = s.text.length > 2800 ? `${s.text.slice(0, 2800)}…` : s.text;
    return [
      `--- 片段 ${i + 1} ${mapBookSourceToTitle(s.source)}·${normalizeBookSectionLabel(s.heading)} ---`,
      s.matchedKeywords.length > 0 ? `命中关键词：${s.matchedKeywords.join('、')}` : '',
      body,
    ]
      .filter((line) => line.length > 0)
      .join('\n');
  });
  return [
    '以下是从《子平真诠》等典籍中按主题路由与关键词检索到的片段，已按主题相关性排序。',
    '请结合 llmContextJson 与命盘事实斟酌使用：可化用其理，不要机械照搬；不要编造书中未出现的句子。',
    '',
    ...lines,
  ].join('\n');
}

export function buildAnalysisSystemPrompt(params: {
  user: DbUser;
  memories: DbUserMemory[];
  baziData: unknown;
  transitData?: TransitSnapshot | null;
  bookRagSnippets?: BookRagSnippet[];
}): string {
  const llmContextJson = buildLlmContextJson(params);
  const ragBlock =
    params.bookRagSnippets && params.bookRagSnippets.length > 0
      ? ['', formatBookRagSection(params.bookRagSnippets), '']
      : [];
  return [
    '你是一个中文八字咨询分析助手。',
    '你的任务不是直接输出散文，而是先按固定八字诊断 pipeline 输出一个合法 JSON。',
    '核心方法是“系统结构 + 问题修复”，不是只看身强身弱。',
    '必须优先参考下面提供的 llmContextJson，它已经压缩为高信号字段，不要被无关展示信息干扰。',
    '如果证据不足，可以保守判断，并在对应字段里说明。',
    '不要输出完整内部推理，只输出简短 reasoningSummary。',
    '所有输出必须是一个合法 JSON 对象，不能出现 Markdown 代码块，不能出现 JSON 以外的任何文字。',
    '请严格按照以下步骤完成：',
    'Step 0 结构类型识别：ordinary / follow / transform / uncertain，并判断是否极端结构。',
    'Step 1 找病：五行严重失衡、刑冲破坏、结构断裂，并给出 primaryFailure。',
    'Step 2 判断是否可救：是否存在修复元素、结构是否具备修复空间。',
    'Step 3 身强身弱：只作为承载能力辅助判断，不能推翻前面病灶判断。',
    'Step 4 找药：主用神和辅助用神必须以“解决问题”为目标，不是套公式。',
    'Step 5 验证药效：检查是否有根、是否被克、被合走、力量是否足够。',
    'Step 6 结构稳定性：稳定 / semi_stable / fragile，并指出循环支持与漏洞。',
    'Step 7 喜忌：以系统稳定为标准，而非个人偏好。',
    'Step 8 致命点：指出最怕什么、在什么条件下崩溃。',
    'Step 9 大运分析：判断当前整体运势作用类型是 repair / amplify_failure / collapse_trigger / mixed。',
    'Step 10 参考依据：若上方提供了典籍片段，输出 0 到 3 条 evidenceSources，每条包含 title、section、reason；title 与 section 必须来自已提供片段，不可编造。',
    'Step 11 性格速览：输出 personalitySnapshot 对象，仅包含 headline（6字以内的性格标签，如"温和务实的领导者"）、description（2到3句口语化中文性格描述，不用术语，温暖杂志风）。基于日主五行与五行平衡推导。',
    'Step 12 年度运势：输出 annualFortune 对象，包含 year（当前年份数字）、score（0到100的整体运势分数）、summary（一句口语化总结，如"上半年平稳，下半年有突破机会"）。基于 luckFlow 分析和流转数据推导。',
    'JSON 字段要求：',
    '- questionSummary: 用一句话概括用户本轮真正想问什么',
    '- chartBasis: 说明是否有八字、来源、是否纳入流转',
    '- reasoningSummary: 1到4条极简步骤摘要',
    '- structureType / failure / rescue / capacity / usefulGods / usefulGodEffectiveness / stability / preferences / failureMode / luckFlow / finalSummary / evidenceSources / confidence / personalitySnapshot / annualFortune 必须全部输出',
    '- finalSummary 必须对应三句话：核心问题、解决方案、运势影响',
    '- evidenceSources 为空时输出 []；若有引用，title 用《书名》，section 用章节名，reason 用一句简短理由',
    '- 注意：chartBasis、structureType、failure、rescue、capacity、usefulGods、usefulGodEffectiveness、stability、preferences、failureMode、luckFlow、finalSummary、personalitySnapshot、annualFortune 都必须是 JSON 对象，不能写成字符串',
    '- 最小合法示例：{"questionSummary":"用户想看整体命盘重点","chartBasis":{"hasBazi":true,"transitIncluded":true},"reasoningSummary":["先看结构","再看病药"],"structureType":{"pattern":"ordinary","isExtreme":false,"extremeNote":"未见极端证据","followAdjustment":"若后续确认从格再改用顺势法"},"failure":{"fiveElementImbalance":["五行偏枯"],"clashes":["需观察刑冲"],"structuralBreaks":["修复链条不稳"],"primaryFailure":"结构失衡"},"rescue":{"rescuable":true,"rescueReason":"仍有修复入口","candidateUsefulGods":["木"]},"capacity":{"dayMasterStrength":"balanced","loadBearing":"承载力中等","note":"身强身弱仅作辅助"},"usefulGods":{"primary":["木"],"support":["水"],"rationale":"先修病再谈扶抑"},"usefulGodEffectiveness":{"rooted":true,"constrained":false,"combinedAway":false,"sufficientForce":true,"effective":true,"reason":"原局与运势都能承接"},"stability":{"level":"semi_stable","positiveLoops":["有修复回路"],"weakPoints":["关键元素怕被冲掉"]},"preferences":{"favorable":["木","水"],"unfavorable":["进一步放大失衡的元素"],"rationale":"以系统稳定为标准"},"failureMode":{"collapseTriggers":["关键用神被冲克"],"collapseCondition":"运势继续放大原局病点"},"luckFlow":{"effectType":"mixed","evidence":["当前流转会改变受力"],"summary":"运势既可能修复也可能放大问题"},"finalSummary":{"coreProblem":"核心问题是结构失衡","solution":"主用神要先修病","trajectoryImpact":"运势会改变整体轨迹"},"evidenceSources":[],"confidence":0.72,"personalitySnapshot":{"headline":"温和务实型","description":"你天生稳重踏实，做事有条理，给人可靠的感觉。适合在需要耐心和细致的领域发展。"},"annualFortune":{"year":2026,"score":68,"summary":"上半年平稳过渡，下半年有突破机会，注意秋季健康。"}}',
    '',
    '输出风格：稳健、克制、以结构证据为先，不要夸张，不要宿命论。',
    '',
    ...ragBlock,
    'llmContextJson：',
    JSON.stringify(llmContextJson, null, 2),
  ].join('\n');
}

export function buildAnswerSystemPrompt(params: {
  user: DbUser;
  analysis: StructuredAnalysis;
}): string {
  return [
    '你是一个中文八字咨询助手，负责把结构化诊断结果写成用户能直接读懂的结论。',
    '不要泄露完整内部推理，只允许参考 reasoningSummary 做极简说明。',
    '回答要求：',
    '1. 先用一句话说核心问题。',
    '2. 再用一句话说是否可救、主用神与稳定方案。',
    '3. 再用一句话说大运或当前运势如何影响整体轨迹。',
    '4. 若有必要，可在最后补 2 到 3 条行动建议，但整体不要太长。',
    '5. 若结构化分析 JSON 里有 evidenceSources，请在回答末尾单独加一个“参考依据：”小节，列出 1 到 3 条《书名·章节》；不要伪造来源。',
    '6. 语气专业、清晰、克制，不要说“根据系统提示”。',
    '',
    `用户显示名：${params.user.display_name ?? '未提供'}`,
    '结构化分析 JSON：',
    JSON.stringify(params.analysis),
  ].join('\n');
}

export function mapConversationMessages(messages: DbMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({
      role: item.role as 'user' | 'assistant',
      content: item.content,
    }));
}
