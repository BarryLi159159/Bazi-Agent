import { Router } from 'express';
import { z } from 'zod';
import { extractBaziSummary, extractZodiac } from '../agent/baziJsonExtract.js';
import { getRequiredAuthUser, requireSupabaseAuth } from '../auth/requireSupabaseAuth.js';
import {
  deleteSessionById,
  getSessionById,
  listSessionsByExternalId,
} from '../db/repositories/sessionsRepo.js';
import { listMessagesBySession } from '../db/repositories/messagesRepo.js';
import { findUserByExternalId } from '../db/repositories/usersRepo.js';

function toIsoOrNull(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return null;
}

function normalizeGender(value: unknown): number | null {
  if (value === 0 || value === 1) {
    return value;
  }
  if (value === '0' || value === '1') {
    return Number(value);
  }
  return null;
}

export const sessionsRouter = Router();
sessionsRouter.use(requireSupabaseAuth);

const messageQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const listSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});

sessionsRouter.get('/', async (req, res) => {
  const parsed = listSessionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const authUser = getRequiredAuthUser(req);
  const rows = await listSessionsByExternalId(authUser.id, parsed.data.limit);

  const sessionsWithPreview = rows.map((row) => {
    const raw = (row.last_message ?? '').replace(/\s+/g, ' ').trim();
    const preview = raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;

    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      message_count: row.message_count,
      last_message: row.last_message,
      last_message_preview: preview || null,
      record_name: row.user_display_name?.trim() || null,
      record_gender: normalizeGender(row.user_gender),
      record_birth_solar: toIsoOrNull(row.user_birth_solar_datetime),
      record_bazi: extractBaziSummary(row.user_bazi_json),
      record_zodiac: extractZodiac(row.user_bazi_json),
    };
  });

  return res.json({ userExternalId: authUser.id, sessions: sessionsWithPreview });
});

sessionsRouter.delete('/:sessionId', async (req, res) => {
  const authUser = getRequiredAuthUser(req);
  const user = await findUserByExternalId(authUser.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const session = await getSessionById(req.params.sessionId);
  if (!session || session.user_id !== user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }

  await deleteSessionById(session.id);
  return res.json({ ok: true });
});

sessionsRouter.get('/:sessionId/messages', async (req, res) => {
  const sessionId = req.params.sessionId;
  const parsed = messageQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const authUser = getRequiredAuthUser(req);
  const user = await findUserByExternalId(authUser.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const session = await getSessionById(sessionId);
  if (!session || session.user_id !== user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const messages = await listMessagesBySession(sessionId, parsed.data.limit);
  return res.json({ sessionId, messages });
});
