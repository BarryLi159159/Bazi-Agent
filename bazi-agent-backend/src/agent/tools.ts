import { existsSync } from 'node:fs';
import { config } from '../config.js';
import { retrieveBookRagSnippets, mapBookSourceToTitle, normalizeBookSectionLabel } from './rag/bookRag.js';
import type { RagTopic } from './rag/topicRouter.js';
import { computeYearlyTransits, pickKeyYears } from './yearlyTransit.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ---------------------------------------------------------------------------
// Tool schemas (OpenAI function calling format)
// ---------------------------------------------------------------------------

export const toolSchemas = [
  {
    type: 'function' as const,
    function: {
      name: 'compute_year_interactions',
      description:
        '计算指定年份的流年干支与原局四柱的刑/冲/合/克关系。必须在讨论任何具体年份之前调用。',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'integer', description: '阳历年份，如 2028' },
        },
        required: ['year'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_dayun_at_year',
      description: '查询某一年用户正处于哪一步大运，返回大运干支、起止年份、十二运、十神等。',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'integer' },
        },
        required: ['year'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_key_years',
      description:
        '列出用户当前年之后若干年里，流年对原局有明显冲合刑或大运交接的关键年份。用于对比多年或挑选值得深入分析的年份。',
      parameters: {
        type: 'object',
        properties: {
          windowYears: { type: 'integer', description: '向前看多少年，默认 10', default: 10 },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_natal_summary',
      description: '获取命盘核心事实：四柱、日主、五行分布、基础格局。用于在回答前确认命盘基础。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lookup_classic_book',
      description:
        '从《子平真诠》等命理典籍中检索与当前主题相关的原文段落。用于引用经典来支撑判断。',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            enum: ['career', 'wealth', 'marriage', 'health', 'luckCycle', 'usefulGod', 'general'],
          },
          query: { type: 'string', description: '检索关键词，如"七杀透干"' },
        },
        required: ['topic', 'query'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

export interface ToolContext {
  chartRich: Record<string, unknown> | null;
  currentYear: number;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
  durationMs: number;
}

export async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  try {
    switch (name) {
      case 'compute_year_interactions': {
        const year = typeof args['year'] === 'number' ? args['year'] : Number(args['year']);
        if (!Number.isFinite(year)) return JSON.stringify({ error: 'invalid year' });
        const entries = computeYearlyTransits({ yearStart: year, yearEnd: year, chartRich: ctx.chartRich });
        const entry = entries[0];
        if (!entry) return JSON.stringify({ year, note: '无算法数据（可能命盘缺失）' });
        return JSON.stringify({
          year: entry.year,
          ganZhi: entry.ganZhi,
          stemElement: entry.stemElement,
          branchElement: entry.branchElement,
          daYun: entry.daYunGanZhi,
          interactions: entry.interactions.map((i) => ({
            type: i.type,
            scope: i.scope,
            target: i.target,
            description: i.description,
          })),
        });
      }

      case 'get_dayun_at_year': {
        const year = typeof args['year'] === 'number' ? args['year'] : Number(args['year']);
        const fortune = isRecord(ctx.chartRich?.['fortune']) ? ctx.chartRich['fortune'] : null;
        const decades = Array.isArray(fortune?.['decades']) ? fortune['decades'] : [];
        const match = decades.find((d) => {
          if (!isRecord(d)) return false;
          const s = typeof d['startYear'] === 'number' ? d['startYear'] : null;
          const e = typeof d['endYear'] === 'number' ? d['endYear'] : null;
          return s !== null && e !== null && year >= s && year <= e;
        });
        if (!match || !isRecord(match)) return JSON.stringify({ year, note: '未找到对应大运' });
        return JSON.stringify({
          year,
          ganZhi: match['ganZhi'],
          startYear: match['startYear'],
          endYear: match['endYear'],
          startAge: match['startAge'],
          endAge: match['endAge'],
          cycleState: match['cycleState'],
          naYin: match['naYin'],
          stemTenGod: match['stemTenGod'],
          branchTenGods: match['branchTenGods'],
        });
      }

      case 'list_key_years': {
        const window = typeof args['windowYears'] === 'number' ? args['windowYears'] : 10;
        const keyYears = pickKeyYears({
          currentYear: ctx.currentYear,
          chartRich: ctx.chartRich,
          windowYears: window,
          maxYears: 8,
        });
        const details = computeYearlyTransits({
          yearStart: ctx.currentYear,
          yearEnd: ctx.currentYear + window,
          chartRich: ctx.chartRich,
        }).filter((e) => keyYears.includes(e.year));
        return JSON.stringify(
          details.map((e) => ({
            year: e.year,
            ganZhi: e.ganZhi,
            daYun: e.daYunGanZhi,
            interactions: e.interactions.map((i) => i.description),
          })),
        );
      }

      case 'get_natal_summary': {
        const basic = isRecord(ctx.chartRich?.['basic']) ? ctx.chartRich['basic'] : {};
        const pillars = isRecord(ctx.chartRich?.['pillars']) ? ctx.chartRich['pillars'] : {};
        const fiveElements = isRecord(ctx.chartRich?.['fiveElements']) ? ctx.chartRich['fiveElements'] : {};
        return JSON.stringify({
          bazi: basic['bazi'],
          zodiac: basic['zodiac'],
          dayMaster: basic['dayMaster'],
          gender: basic['gender'],
          solar: basic['solar'],
          pillars,
          fiveElements: {
            metal: fiveElements['metal'],
            wood: fiveElements['wood'],
            water: fiveElements['water'],
            fire: fiveElements['fire'],
            earth: fiveElements['earth'],
          },
        });
      }

      case 'lookup_classic_book': {
        const topic = (typeof args['topic'] === 'string' ? args['topic'] : 'general') as RagTopic;
        const query = typeof args['query'] === 'string' ? args['query'] : '';
        if (!query.trim()) return JSON.stringify({ error: 'empty query' });
        if (!config.BOOK_RAG_ENABLED || !existsSync(config.BAZI_BOOKS_PATH)) {
          return JSON.stringify({ note: '典籍 RAG 未启用', snippets: [] });
        }
        const snippets = await retrieveBookRagSnippets({
          booksPath: config.BAZI_BOOKS_PATH,
          queryText: query,
          topK: 3,
          minScore: config.BOOK_RAG_MIN_SCORE,
          topic,
        });
        return JSON.stringify(
          snippets.slice(0, 2).map((s) => ({
            title: mapBookSourceToTitle(s.source),
            section: normalizeBookSectionLabel(s.heading),
            excerpt: s.text.length > 600 ? `${s.text.slice(0, 600)}…` : s.text,
            matchedKeywords: s.matchedKeywords,
          })),
        );
      }

      default:
        return JSON.stringify({ error: `unknown tool: ${name}` });
    }
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : 'tool execution failed' });
  }
}
