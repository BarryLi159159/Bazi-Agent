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

  private detectQuestionSummary(lastUser: string): string {
    return lastUser.slice(0, 80) || '用户希望获得命盘系统分析';
  }

  private detectUsefulGods(hasBazi: boolean, transitIncluded: boolean): { primary: string[]; support: string[]; rationale: string } {
    if (!hasBazi) {
      return {
        primary: ['待补盘'],
        support: [],
        rationale: '当前缺少完整命盘，暂时无法稳定锁定用神，只能先补足基础盘。 ',
      };
    }

    return {
      primary: transitIncluded ? ['木', '水'] : ['木'],
      support: transitIncluded ? ['水'] : ['火'],
      rationale: '先用能修复结构失衡、同时避免放大冲克的元素作为主用神，再用辅助元素维持系统连续性。',
    };
  }

  async generateStructuredAnalysis(messages: ModelMessage[]): Promise<StructuredAnalysis> {
    const lastUser = [...messages].reverse().find((item) => item.role === 'user')?.content ?? '';
    const system = messages.find((item) => item.role === 'system')?.content ?? '';
    const memorySection = this.extractSection(system, '用户长期记忆：', '八字信息：');
    const baziSection = this.extractSection(system, '八字信息：', '当前流转信息：');
    const transitSection = this.extractSection(system, '当前流转信息：');
    const hasBazi = Boolean(baziSection && !/暂无八字信息/.test(baziSection));
    const transitIncluded = Boolean(transitSection && !/暂无当前流转信息/.test(transitSection));

    const usefulGods = this.detectUsefulGods(hasBazi, transitIncluded);

    return {
      questionSummary: this.detectQuestionSummary(lastUser),
      chartBasis: {
        hasBazi,
        baziSource: hasBazi ? 'stored-chart' : undefined,
        transitIncluded,
      },
      reasoningSummary: [
        '先识别命盘属于哪类结构，再判断是否极端。',
        hasBazi ? '先找系统的病，再看是否有药能修。' : '当前缺少完整八字，诊断只能保守输出。',
        transitIncluded ? '把当前流转纳入系统稳定性与运势影响判断。' : '当前未纳入流转，只做基础结构判断。',
      ],
      structureType: {
        pattern: hasBazi ? 'ordinary' : 'uncertain',
        isExtreme: false,
        extremeNote: hasBazi ? '当前未见足以直接判定为极端从格或化格的证据。' : '缺少完整盘，无法判断是否极端结构。',
        followAdjustment: hasBazi ? '若后续确认是从格，应改用顺势分析逻辑，不再以扶抑为主。' : '暂无从格判定依据。',
      },
      failure: {
        fiveElementImbalance: hasBazi ? ['五行分布存在偏枯或偏盛，需要进一步用结构修复。'] : ['基础命盘信息不足，无法准确判断五行失衡。'],
        clashes: transitIncluded ? ['需结合流转观察刑冲是否放大原局问题。'] : ['当前未纳入流转冲克信息。'],
        structuralBreaks: hasBazi ? ['重点检查关键修复元素是否缺位或被压制。'] : ['缺少可验证的结构链路。'],
        primaryFailure: hasBazi ? '命盘的主要问题不在单纯强弱，而在结构失衡与关键修复链条不稳。' : '当前缺少完整盘，主要问题是无法建立可靠结构判断。',
      },
      rescue: {
        rescuable: hasBazi,
        rescueReason: hasBazi ? '命盘仍有可作为修复入口的元素，结构存在调整空间。' : '连基础结构都未确认，无法判断是否可救。',
        candidateUsefulGods: usefulGods.primary,
      },
      capacity: {
        dayMasterStrength: hasBazi ? 'balanced' : 'weak',
        loadBearing: hasBazi ? '日主承载能力可作为辅助参考，但不能替代病药判断。' : '当前无法安全评估承载能力。',
        note: hasBazi ? '身强身弱仅用于判断是否能承受用神。' : '建议先补盘再谈承载能力。',
      },
      usefulGods,
      usefulGodEffectiveness: {
        rooted: hasBazi,
        constrained: false,
        combinedAway: false,
        sufficientForce: hasBazi,
        effective: hasBazi,
        reason: hasBazi ? '当前可把候选用神作为修复结构的主要抓手，但仍需结合原局根气与运势验证。' : '没有命盘就无法验证用神有效性。',
      },
      stability: {
        level: hasBazi ? (transitIncluded ? 'semi_stable' : 'fragile') : 'fragile',
        positiveLoops: hasBazi ? ['存在一定的结构修复回路，但还不够稳。'] : [],
        weakPoints: hasBazi ? ['一旦关键修复元素被冲掉，整体结构容易失衡。'] : ['基础信息不足导致结构评估本身不稳定。'],
      },
      preferences: {
        favorable: usefulGods.primary.concat(usefulGods.support).slice(0, 5),
        unfavorable: hasBazi ? ['进一步放大失衡的元素', '直接冲断修复链条的元素'] : ['任何基于不完整盘的激进结论'],
        rationale: '喜忌以系统是否更稳定为标准，而不是套用单一扶抑规则。',
      },
      failureMode: {
        collapseTriggers: hasBazi ? ['关键修复元素被冲克', '原局失衡被大运进一步放大'] : ['在基础信息缺失下做强结论'],
        collapseCondition: hasBazi ? '最怕运势继续放大原局病灶，同时没有修复元素承接。' : '最怕在缺盘情况下直接做强判断。',
      },
      luckFlow: {
        effectType: transitIncluded ? 'mixed' : hasBazi ? 'repair' : 'amplify_failure',
        evidence: transitIncluded ? ['当前流转会改变结构受力，需要动态观察。'] : ['当前只做静态结构判断。'],
        summary: transitIncluded ? '当前运势既可能提供修复机会，也可能放大原局问题，要看是否引入真正有效的用神。' : hasBazi ? '当前更适合先看原局的修复空间，再判断运势是否协同。' : '没有完整命盘时，运势判断可靠度很低。',
      },
      finalSummary: {
        coreProblem: hasBazi ? '这个命盘的核心问题是结构失衡与关键修复链条不够稳定。' : '当前最大的核心问题是缺少完整命盘，无法建立可靠结构判断。',
        solution: hasBazi ? '仍有修复空间，关键是找到真正能修病的主用神并验证它是否有效。' : '先补全命盘与关键信息，再谈用神和稳定方案。',
        trajectoryImpact: transitIncluded ? '运势会通过放大问题或提供修复入口来改变人生轨迹，关键看它是否真正引入有效用神。' : '在未纳入流转时，只能先做静态判断，动态轨迹还需要结合大运再看。',
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
          analysis.finalSummary.coreProblem,
          analysis.finalSummary.solution,
          analysis.finalSummary.trajectoryImpact,
          '',
          `结构类型：${analysis.structureType.pattern}；系统稳定性：${analysis.stability.level}。`,
          `主用神：${analysis.usefulGods.primary.join('、')}；辅助用神：${analysis.usefulGods.support.join('、') || '暂无'}。`,
          `触发崩溃条件：${analysis.failureMode.collapseCondition}`,
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
