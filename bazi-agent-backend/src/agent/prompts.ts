import type { DbMessage, DbUser, DbUserMemory } from '../db/types.js';
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
    const eight = pickStringField(bazi, '八字');
    const zodiac = pickStringField(bazi, '生肖');
    const dayMaster = pickStringField(bazi, '日主');
    const solar = pickStringField(bazi, '阳历');

    const lines = [
      eight ? `八字：${eight}` : undefined,
      zodiac ? `生肖：${zodiac}` : undefined,
      dayMaster ? `日主：${dayMaster}` : undefined,
      solar ? `出生阳历：${solar}` : undefined,
    ].filter((line): line is string => Boolean(line));

    if (lines.length > 0) {
      return lines.join('\n');
    }

    return `八字结构化信息：${JSON.stringify(bazi).slice(0, 700)}`;
  }

  return `八字信息：${String(bazi)}`;
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

export function buildAnalysisSystemPrompt(params: {
  user: DbUser;
  memories: DbUserMemory[];
  baziData: unknown;
  transitData?: TransitSnapshot | null;
}): string {
  return [
    '你是一个中文八字咨询分析助手。',
    '你的任务不是直接和用户闲聊，而是先把本轮问题整理成结构化分析。',
    '必须优先围绕用户这一轮真实问题，不要泛泛而谈。',
    '可以参考用户资料、长期记忆、八字信息、当前流转信息，但不要编造未提供的事实。',
    '不要输出完整内部推理，只输出简短 reasoningSummary。',
    '所有输出必须是一个合法 JSON 对象，不能出现 Markdown 代码块，不能出现 JSON 以外的任何文字。',
    'JSON 字段要求：',
    '- intent: general/career/relationship/wealth/health/study 之一',
    '- questionSummary: 用一句话概括用户本轮真正想问什么',
    '- chartBasis.hasBazi: 是否有八字信息',
    '- chartBasis.baziSource: 若未知可省略',
    '- chartBasis.transitIncluded: 是否纳入流转信息',
    '- chartBasis.transitGeneratedAt: 若有则填写',
    '- reasoningSummary: 1到4条简短步骤，每条不超过120字',
    '- analysis.coreThemes: 1到4个关键词',
    '- analysis.timeWindows: 0到4项，每项包含 label/signal/note',
    '- analysis.risks: 0到4条风险提醒',
    '- analysis.advice: 1到5条可执行建议',
    '- confidence: 0到1之间的小数',
    '',
    '输出风格：稳健、克制、可执行，不要夸张，不要宿命论。',
    '',
    buildSharedContext(params),
  ].join('\n');
}

export function buildAnswerSystemPrompt(params: {
  user: DbUser;
  analysis: StructuredAnalysis;
}): string {
  return [
    '你是一个中文八字咨询助手，负责把结构化分析写成用户能直接读懂的最终回答。',
    '不要泄露完整内部推理，只允许参考 reasoningSummary 做极简说明。',
    '回答要求：',
    '1. 先直接回应用户问题，给出结论。',
    '2. 再用 2 到 3 段解释主要判断依据。',
    '3. 最后给 2 到 4 条可执行建议。',
    '4. 如果 analysis.risks 不为空，要自然加入风险提醒。',
    '5. 语气专业、清晰、克制，不要说“根据系统提示”。',
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
