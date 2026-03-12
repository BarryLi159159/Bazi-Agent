import { config } from '../config.js';
import type { ModelMessage, ModelProvider } from './types.js';

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class OpenAIModelProvider implements ModelProvider {
  readonly name = 'openai-chat-completions';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async generateReply(messages: ModelMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.6,
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

  async generateReply(messages: ModelMessage[]): Promise<string> {
    const lastUser = [...messages].reverse().find((item) => item.role === 'user')?.content ?? '';
    const system = messages.find((item) => item.role === 'system')?.content ?? '';

    const memorySection = this.extractSection(system, '用户长期记忆：', '八字信息：');
    const baziSection = this.extractSection(system, '八字信息：').slice(0, 400);

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

export function createModelProvider(): ModelProvider {
  if (config.OPENAI_API_KEY) {
    return new OpenAIModelProvider(config.OPENAI_API_KEY, config.OPENAI_BASE_URL, config.OPENAI_MODEL);
  }
  return new RuleBasedModelProvider();
}
