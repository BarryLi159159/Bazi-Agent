import { Router } from 'express';
import { z } from 'zod';
import { getRequiredAuthUser, requireSupabaseAuth } from '../auth/requireSupabaseAuth.js';
import { findUserByExternalId } from '../db/repositories/usersRepo.js';
import { listRecentMemories } from '../db/repositories/memoriesRepo.js';
import { generateLifePrediction } from '../agent/predictionService.js';
import { listRecentMessagesBySession } from '../db/repositories/messagesRepo.js';
import { listSessionsByExternalId } from '../db/repositories/sessionsRepo.js';
import { pickKeyYears } from '../agent/yearlyTransit.js';

const predictionBodySchema = z.object({
  forceRefresh: z.boolean().optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function findLatestStructuredAnalysis(externalId: string): Promise<Record<string, unknown> | null> {
  const sessions = await listSessionsByExternalId(externalId, 1);
  const firstSession = sessions[0];
  if (!firstSession) return null;
  const messages = await listRecentMessagesBySession(firstSession.id, 5);
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;
    const meta = isRecord(msg.meta_json) ? msg.meta_json : null;
    const structured = isRecord(meta?.['structured']) ? (meta['structured'] as Record<string, unknown>) : null;
    if (structured && typeof structured['questionSummary'] === 'string') {
      return structured;
    }
  }
  return null;
}

export const predictionsRouter = Router();
predictionsRouter.use(requireSupabaseAuth);

predictionsRouter.post('/', async (req, res) => {
  const parsed = predictionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
  }

  const authUser = getRequiredAuthUser(req);
  const user = await findUserByExternalId(authUser.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!user.bazi_json) {
    return res.status(400).json({ error: '请先排盘再使用人生预测功能' });
  }

  const bazi = isRecord(user.bazi_json) ? user.bazi_json : null;
  const chartRich = isRecord(bazi?.['chart_rich']) ? (bazi['chart_rich'] as Record<string, unknown>) : null;

  const currentYear = new Date().getFullYear();
  const keyYears = pickKeyYears({ currentYear, chartRich });
  const yearStart = keyYears[0] ?? currentYear;
  const yearEnd = keyYears[keyYears.length - 1] ?? currentYear + 1;

  try {
    const memories = await listRecentMemories(user.id, 8);
    const existingAnalysis = await findLatestStructuredAnalysis(authUser.id);

    const result = await generateLifePrediction({
      user,
      memories,
      keyYears,
      yearStart,
      yearEnd,
      forceRefresh: parsed.data.forceRefresh ?? false,
      existingAnalysis,
    });

    return res.json({ prediction: result.prediction, cached: result.cached });
  } catch (error) {
    console.error('[Predictions] generation failed', error);
    if (error instanceof Error && error.message.includes('OpenAI')) {
      return res.status(502).json({ error: error.message });
    }
    throw error;
  }
});
