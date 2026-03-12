import { Router } from 'express';
import { z } from 'zod';
import { listMessagesBySession } from '../db/repositories/messagesRepo.js';
import { listSessionsByUserId } from '../db/repositories/sessionsRepo.js';
import { findUserByExternalId } from '../db/repositories/usersRepo.js';

export const sessionsRouter = Router();

const messageQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const listSessionsQuerySchema = z.object({
  userExternalId: z.string().min(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

sessionsRouter.get('/', async (req, res) => {
  const parsed = listSessionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const user = await findUserByExternalId(parsed.data.userExternalId);
  if (!user) {
    return res.json({ sessions: [] });
  }

  const sessions = await listSessionsByUserId(user.id, parsed.data.limit);
  const sessionsWithPreview = sessions.map((session) => {
    const raw = (session.last_message ?? '').replace(/\s+/g, ' ').trim();
    const preview = raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
    return {
      ...session,
      last_message_preview: preview || null,
    };
  });

  return res.json({ userExternalId: parsed.data.userExternalId, sessions: sessionsWithPreview });
});

sessionsRouter.get('/:sessionId/messages', async (req, res) => {
  const sessionId = req.params.sessionId;
  const parsed = messageQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const messages = await listMessagesBySession(sessionId, parsed.data.limit);
  return res.json({ sessionId, messages });
});
