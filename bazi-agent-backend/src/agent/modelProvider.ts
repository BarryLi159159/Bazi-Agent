import { config } from '../config.js';
import { structuredAnalysisSchema, type ModelMessage, type ModelProvider, type StructuredAnalysis } from './types.js';

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Structured analysis did not contain a JSON object');
  }
  return trimmed.slice(start, end + 1);
}

export class OpenAIModelProvider implements ModelProvider {
  readonly name = 'openai-chat-completions';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  private async requestContent(
    messages: ModelMessage[],
    options?: {
      temperature?: number;
      responseFormat?: { type: 'json_object' };
    },
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.6,
        response_format: options?.responseFormat,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenAI returned empty content');
    }

    return content;
  }

  async generateStructuredAnalysis(messages: ModelMessage[]): Promise<StructuredAnalysis> {
    const content = await this.requestContent(messages, {
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
    });
    const parsed = JSON.parse(extractJsonObject(content));
    return structuredAnalysisSchema.parse(parsed);
  }

  async generateReply(messages: ModelMessage[]): Promise<string> {
    return this.requestContent(messages, { temperature: 0.6 });
  }
}

export class RuleBasedModelProvider implements ModelProvider {
  readonly name = 'rule-based-fallback';

  private extractSection(systemPrompt: string, startMark: string, endMark?: string): string {
    const start = systemPrompt.indexOf(startMark);
    if (start < 0) {
      return '';
    }
    const from = systemPrompt.slice(start + startMark.length);
    if (!endMark) {
      return from.trim();
    }
    const end = from.indexOf(endMark);
    return (end >= 0 ? from.slice(0, end) : from).trim();
  }

  private buildJobPlanReply(lastUser: string, memorySection: string, baziSection: string): string {
    const cityHint = /上海/.test(memorySection) ? '上海' : '你的目标城市';
    const roleHint = /产品经理/.test(memorySection) ? '互联网产品经理' : '目标岗位';

    return [
      `我记得你的目标是：${roleHint}，优先城市 ${cityHint}。`,
      '',
      '下面是30天求职计划（按周执行）：',
      '第1周：定位与材料',
      `1. 只投递 ${cityHint} 的 ${roleHint} 岗位，明确 20 家目标公司名单。`,
      '2. 完成1版简历 + 1版项目集，重点写“业务结果”和“指标提升”。',
      '3. 每天30分钟复盘岗位 JD，整理高频能力要求。',
      '',
      '第2周：密集投递与内推',
      '1. 每天定量投递 8-12 个高匹配岗位，不海投。',
      '2. 启动内推渠道：前同事、行业群、招聘平台直聊。',
      '3. 每晚复盘投递反馈，更新关键词与项目描述。',
      '',
      '第3周：面试冲刺',
      '1. 准备 10 个结构化面试题（项目拆解、冲突处理、数据分析）。',
      '2. 每天进行 1 次模拟面试，重点练“结论先行”。',
      '3. 建立面试记录表：公司、轮次、问题、改进项。',
      '',
      '第4周：谈薪与选择',
      '1. 对进入终面的机会做优先级排序（成长性/团队/薪资）。',
      '2. 准备谈薪底线与目标区间，统一口径。',
      '3. 形成最终决策表，48小时内完成 offer 选择。',
      '',
      `八字信息可作为辅助参考：${baziSection || '暂无八字信息'}`,
    ].join('\n');
  }

  private detectIntent(lastUser: string): StructuredAnalysis['intent'] {
    if (/事业|工作|求职|面试|升职|职业/.test(lastUser)) {
      return 'career';
    }
    if (/感情|恋爱|婚姻|伴侣|桃花/.test(lastUser)) {
      return 'relationship';
    }
    if (/财运|收入|赚钱|投资|副业/.test(lastUser)) {
      return 'wealth';
    }
    if (/健康|身体|睡眠|情绪|焦虑/.test(lastUser)) {
      return 'health';
    }
    if (/学习|考试|留学|读书/.test(lastUser)) {
      return 'study';
    }
    return 'general';
  }

  async generateStructuredAnalysis(messages: ModelMessage[]): Promise<StructuredAnalysis> {
    const lastUser = [...messages].reverse().find((item) => item.role === 'user')?.content ?? '';
    const system = messages.find((item) => item.role === 'system')?.content ?? '';
    const memorySection = this.extractSection(system, '用户长期记忆：', '八字信息：');
    const baziSection = this.extractSection(system, '八字信息：', '当前流转信息：');
    const transitSection = this.extractSection(system, '当前流转信息：');
    const hasBazi = Boolean(baziSection && !/暂无八字信息/.test(baziSection));
    const transitIncluded = Boolean(transitSection && !/暂无当前流转信息/.test(transitSection));

    return {
      intent: this.detectIntent(lastUser),
      questionSummary: lastUser.slice(0, 80) || '用户希望获得命理建议',
      chartBasis: {
        hasBazi,
        transitIncluded,
      },
      reasoningSummary: [
        '先识别本轮问题的主题和时间范围。',
        hasBazi ? '结合已有八字信息提炼主要结构信号。' : '当前缺少完整八字，只能做保守判断。',
        transitIncluded ? '把当前流转层级纳入节奏判断。' : '当前没有纳入流转细节。',
      ],
      analysis: {
        coreThemes: [this.detectIntent(lastUser), hasBazi ? '命盘结构' : '补充信息', transitIncluded ? '当前节奏' : '基础判断'],
        timeWindows: [
          {
            label: '近30天',
            signal: 'medium',
            note: '适合先收拢问题和目标，避免同时推进过多方向。',
          },
          {
            label: '未来3个月',
            signal: hasBazi ? 'high' : 'medium',
            note: '更适合根据阶段反馈调整策略，逐步放大有效动作。',
          },
        ],
        risks: memorySection ? ['不要被单一事件放大情绪波动。'] : ['目前资料有限，结论要保守使用。'],
        advice: [
          '先把这次咨询收敛成一个最核心的问题。',
          '把目标拆成近30天和3个月两个节奏。',
          transitIncluded ? '优先顺着当前节奏推进，不要同时频繁换方向。' : '补充更多出生与近况信息后，判断会更稳。',
        ],
      },
      confidence: hasBazi ? 0.72 : 0.46,
    };
  }

  async generateReply(messages: ModelMessage[]): Promise<string> {
    const lastUser = [...messages].reverse().find((item) => item.role === 'user')?.content ?? '';
    const system = messages.find((item) => item.role === 'system')?.content ?? '';

    const memorySection = this.extractSection(system, '用户长期记忆：', '八字信息：');
    const baziSection = this.extractSection(system, '八字信息：').slice(0, 400);

    const jsonText = this.extractSection(system, '结构化分析 JSON：');
    if (jsonText) {
      try {
        const analysis = structuredAnalysisSchema.parse(JSON.parse(extractJsonObject(jsonText)));
        return [
          `这次我先围绕“${analysis.questionSummary}”来回答。`,
          '',
          `重点主题：${analysis.analysis.coreThemes.join('、')}。`,
          analysis.reasoningSummary.map((item, index) => `${index + 1}. ${item}`).join('\n'),
          '',
          analysis.analysis.timeWindows.length > 0
            ? `时间节奏：${analysis.analysis.timeWindows.map((item) => `${item.label}（${item.signal}）${item.note}`).join('；')}`
            : '时间节奏：先以近期稳步推进为主。',
          '',
          `建议：${analysis.analysis.advice.join('；')}`,
          analysis.analysis.risks.length > 0 ? `提醒：${analysis.analysis.risks.join('；')}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      } catch (error) {
        console.warn('[RuleBasedModelProvider] failed to parse structured JSON for reply', error);
      }
    }

    if (/30天|求职计划|行动计划/.test(lastUser)) {
      return this.buildJobPlanReply(lastUser, memorySection, baziSection);
    }

    return [
      `我收到你的问题：${lastUser}`,
      '',
      '结合你当前的资料，我先给一个可执行版本：',
      '1. 明确这次咨询的主问题（事业/感情/财务/健康）只选一个。',
      '2. 按主问题拆成3个时间段：近30天、3个月、12个月。',
      '3. 每个时间段只设1个行动目标，并每周复盘。',
      '',
      `我记住的近期信息：${memorySection || '暂无记忆'}`,
      '',
      `当前可用八字摘要：${baziSection || '暂无八字信息'}`,
      '',
      '如果你愿意，我下一条可以直接给你“30天行动版”清单。',
    ].join('\n');
  }
}

export function createModelProvider(apiKeyOverride?: string | null): ModelProvider {
  const apiKey = apiKeyOverride?.trim() || config.OPENAI_API_KEY;
  if (apiKey) {
    return new OpenAIModelProvider(apiKey, config.OPENAI_BASE_URL, config.OPENAI_MODEL);
  }
  return new RuleBasedModelProvider();
}
