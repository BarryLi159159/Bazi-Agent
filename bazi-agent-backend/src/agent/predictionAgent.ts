import { config } from '../config.js';
import { executeTool, toolSchemas, type ToolCallRecord, type ToolContext } from './tools.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

interface OpenAIResponse {
  choices?: Array<{
    message?: OpenAIMessage;
    finish_reason?: string;
  }>;
}

const MAX_STEPS = 6;

function buildPredictionSystemPrompt(language: 'zh' | 'en' = 'zh'): string {
  const isEnglish = language === 'en';
  const outputLanguage = isEnglish
    ? 'Write your final answer in fluent, professional English. Keep bazi-specific tags (干支 like 甲辰, 冲/合/刑, 七杀, etc.) in their Chinese form when quoting algorithm output, but the explanation must be in English.'
    : '用专业、克制、清晰的中文作答。';

  return [
    '你是一个八字预测 agent。你的任务是回答用户关于具体年份、运势走向的问题。',
    '',
    '你有一组工具可以调用：',
    '- get_natal_summary：拿命盘基础事实（用前必先调用一次）',
    '- compute_year_interactions(year)：获取某年流年与原局的算法化冲合刑克',
    '- get_dayun_at_year(year)：查该年所在大运',
    '- list_key_years：列出未来关键年份',
    '- lookup_classic_book(topic, query)：检索命理典籍原文',
    '',
    '工作方式：',
    '1. 先调用 get_natal_summary 了解命盘（如果还没有）。',
    '2. 用户问到具体年份时，必须先调 compute_year_interactions 和 get_dayun_at_year 拿到精确数据，不要凭感觉。',
    '3. 需要引用典籍时调 lookup_classic_book。',
    '4. 拿到所有需要的数据后，给出简洁专业的回答，引用算法结果和典籍。',
    '5. 不要一次性调所有工具——按需调用，保持高效。',
    '6. 回答要克制、不夸张、不宿命论，给出可执行建议。',
    '',
    '重要：所有关于干支、冲合刑、大运的事实判断都必须通过工具获取，不可自行推算。',
    '',
    outputLanguage,
  ].join('\n');
}

async function callOpenAI(apiKey: string, messages: OpenAIMessage[]): Promise<OpenAIMessage> {
  const response = await fetch(`${config.OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.OPENAI_MODEL,
      messages,
      tools: toolSchemas,
      tool_choice: 'auto',
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error('OpenAI returned empty message');
  }
  return message;
}

export interface AgentRunResult {
  finalText: string;
  toolTrace: ToolCallRecord[];
  stepsUsed: number;
}

export async function runPredictionAgent(params: {
  apiKey: string;
  userMessage: string;
  priorTurns: Array<{ role: 'user' | 'assistant'; content: string }>;
  language?: 'zh' | 'en';
  ctx: ToolContext;
}): Promise<AgentRunResult> {
  const { apiKey, userMessage, priorTurns, language = 'zh', ctx } = params;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: buildPredictionSystemPrompt(language) },
    ...priorTurns.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: userMessage },
  ];

  const toolTrace: ToolCallRecord[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const msg = await callOpenAI(apiKey, messages);
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        finalText: msg.content ?? '',
        toolTrace,
        stepsUsed: step + 1,
      };
    }

    for (const call of msg.tool_calls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(call.function.arguments || '{}');
      } catch {
        parsedArgs = {};
      }
      const started = Date.now();
      const result = await executeTool(call.function.name, parsedArgs, ctx);
      const durationMs = Date.now() - started;

      toolTrace.push({
        name: call.function.name,
        args: parsedArgs,
        result,
        durationMs,
      });

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result,
      });
    }
  }

  return {
    finalText: '（超出 agent 最大步数，请换一种问法或减少范围）',
    toolTrace,
    stepsUsed: MAX_STEPS,
  };
}
