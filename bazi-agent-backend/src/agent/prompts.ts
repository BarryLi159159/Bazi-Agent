import type { DbMessage, DbUser, DbUserMemory } from '../db/types.js';

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

export function buildSystemPrompt(params: {
  user: DbUser;
  memories: DbUserMemory[];
  baziData: unknown;
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
