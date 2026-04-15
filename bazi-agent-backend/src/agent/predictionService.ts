import { config } from '../config.js';
import { findPrediction, upsertPrediction } from '../db/repositories/predictionsRepo.js';
import { findUserSecret } from '../db/repositories/userSecretsRepo.js';
import { decryptSecret } from '../security/secretsCrypto.js';
import { buildLifePredictionPrompt, buildLlmContextJson } from './prompts.js';
import { OpenAIModelProvider } from './modelProvider.js';
import { lifePredictionSchema, type LifePrediction } from './types.js';
import { computeYearlyTransits } from './yearlyTransit.js';
import type { DbUser, DbUserMemory } from '../db/types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function resolveUserOpenAiKey(userId: string): Promise<string | null> {
  const secret = await findUserSecret(userId, 'openai');
  if (!secret) return null;
  try {
    return decryptSecret(secret.encrypted_secret);
  } catch {
    return null;
  }
}

function compactAnalysis(full: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!full) return null;
  const usefulGods = isRecord(full['usefulGods']) ? full['usefulGods'] : null;
  const preferences = isRecord(full['preferences']) ? full['preferences'] : null;
  const stability = isRecord(full['stability']) ? full['stability'] : null;
  const structureType = isRecord(full['structureType']) ? full['structureType'] : null;
  return {
    pattern: structureType?.['pattern'] ?? null,
    dayMasterStrength: isRecord(full['capacity']) ? full['capacity']['dayMasterStrength'] : null,
    stabilityLevel: stability?.['level'] ?? null,
    primaryUsefulGods: usefulGods?.['primary'] ?? [],
    favorable: preferences?.['favorable'] ?? [],
    unfavorable: preferences?.['unfavorable'] ?? [],
  };
}

export async function generateLifePrediction(params: {
  user: DbUser;
  memories: DbUserMemory[];
  keyYears: number[];
  yearStart: number;
  yearEnd: number;
  forceRefresh?: boolean;
  existingAnalysis?: Record<string, unknown> | null;
}): Promise<{ prediction: LifePrediction; cached: boolean }> {
  const { user, memories, keyYears, yearStart, yearEnd, forceRefresh } = params;

  if (!forceRefresh) {
    const cached = await findPrediction(user.id, yearStart, yearEnd);
    if (cached) {
      const parsed = lifePredictionSchema.safeParse(cached.prediction_json);
      if (parsed.success) {
        return { prediction: parsed.data, cached: true };
      }
    }
  }

  const bazi = isRecord(user.bazi_json) ? user.bazi_json : null;
  const chartRich = isRecord(bazi?.['chart_rich']) ? (bazi['chart_rich'] as Record<string, unknown>) : null;

  const keyYearSet = new Set(keyYears);
  const allTransits = computeYearlyTransits({ yearStart, yearEnd, chartRich });
  const filteredTransits = allTransits.filter((t) => keyYearSet.has(t.year));

  const llmContextJson = buildLlmContextJson({ user, memories, baziData: user.bazi_json });

  const compactTransits = filteredTransits.map((t) => ({
    year: t.year,
    ganZhi: t.ganZhi,
    stemEl: t.stemElement,
    branchEl: t.branchElement,
    daYun: t.daYunGanZhi,
    hits: t.interactions.map((i) => i.description),
  }));

  const yearsList = keyYears.join(',');
  const prompt = buildLifePredictionPrompt({
    natalChartJson: llmContextJson,
    yearlyTransits: compactTransits,
    existingAnalysis: compactAnalysis(params.existingAnalysis ?? null),
  });

  const apiKey = (await resolveUserOpenAiKey(user.id))?.trim() || config.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('No OpenAI API key available for prediction');
  }

  const response = await fetch(`${config.OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.OPENAI_MODEL,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `只预测这几个关键年份：${yearsList}。` },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenAI returned empty content for prediction');
  }

  const parsed: unknown = JSON.parse(content);
  const validated = lifePredictionSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Life prediction schema validation failed: ${JSON.stringify(validated.error.issues).slice(0, 500)}`);
  }

  await upsertPrediction({
    userId: user.id,
    yearStart,
    yearEnd,
    predictionJson: validated.data,
    modelProvider: 'openai-chat-completions',
  });

  return { prediction: validated.data, cached: false };
}
