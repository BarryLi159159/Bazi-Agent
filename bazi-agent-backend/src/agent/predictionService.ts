import { findPrediction, upsertPrediction } from '../db/repositories/predictionsRepo.js';
import { findUserSecret } from '../db/repositories/userSecretsRepo.js';
import { decryptSecret } from '../security/secretsCrypto.js';
import { buildLifePredictionPrompt, buildLlmContextJson } from './prompts.js';
import { createModelProvider } from './modelProvider.js';
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

export async function generateLifePrediction(params: {
  user: DbUser;
  memories: DbUserMemory[];
  yearStart: number;
  yearEnd: number;
  forceRefresh?: boolean;
  existingAnalysis?: Record<string, unknown> | null;
}): Promise<{ prediction: LifePrediction; cached: boolean }> {
  const { user, memories, yearStart, yearEnd, forceRefresh } = params;

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

  const yearlyTransits = computeYearlyTransits({ yearStart, yearEnd, chartRich });

  const llmContextJson = buildLlmContextJson({ user, memories, baziData: user.bazi_json });

  const prompt = buildLifePredictionPrompt({
    natalChartJson: llmContextJson,
    yearlyTransits: yearlyTransits.map((t) => ({
      year: t.year,
      ganZhi: t.ganZhi,
      stem: t.stem,
      branch: t.branch,
      stemElement: t.stemElement,
      branchElement: t.branchElement,
      daYunGanZhi: t.daYunGanZhi,
      interactions: t.interactions.map((i) => ({
        type: i.type,
        scope: i.scope,
        target: i.target,
        description: i.description,
      })),
    })),
    existingAnalysis: params.existingAnalysis ?? null,
  });

  const modelProvider = createModelProvider(await resolveUserOpenAiKey(user.id));

  const content = await modelProvider.generateReply([
    { role: 'system', content: prompt },
    { role: 'user', content: `请为我生成 ${yearStart} 到 ${yearEnd} 年的人生预测。` },
  ]);

  let parsed: unknown;
  const trimmed = content.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error('Life prediction response did not contain valid JSON');
  }
  parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));

  const validated = lifePredictionSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Life prediction schema validation failed: ${JSON.stringify(validated.error.issues).slice(0, 500)}`);
  }

  await upsertPrediction({
    userId: user.id,
    yearStart,
    yearEnd,
    predictionJson: validated.data,
    modelProvider: modelProvider.name,
  });

  return { prediction: validated.data, cached: false };
}
