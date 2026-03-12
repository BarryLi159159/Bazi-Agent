import { Router } from 'express';
import { z } from 'zod';
import { findUserByExternalId, upsertUser } from '../db/repositories/usersRepo.js';

const upsertUserSchema = z.object({
  externalId: z.string().min(1),
  displayName: z.string().min(1).optional(),
  gender: z.union([z.literal(0), z.literal(1)]).optional(),
  birthSolarDatetime: z.string().datetime({ offset: true }).optional(),
  birthLunarDatetime: z.string().min(1).optional(),
  profile: z.record(z.unknown()).optional(),
});

export const usersRouter = Router();

usersRouter.post('/upsert', async (req, res) => {
  const parsed = upsertUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  const user = await upsertUser({
    externalId: parsed.data.externalId,
    displayName: parsed.data.displayName,
    gender: parsed.data.gender,
    birthSolarDatetime: parsed.data.birthSolarDatetime,
    birthLunarDatetime: parsed.data.birthLunarDatetime,
    profileJson: parsed.data.profile,
  });

  return res.json({ user });
});

usersRouter.get('/:externalId', async (req, res) => {
  const externalId = req.params.externalId;
  const user = await findUserByExternalId(externalId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user });
});
