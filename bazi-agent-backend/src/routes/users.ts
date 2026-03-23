import { Router } from 'express';
import { z } from 'zod';
import { getCurrentTransitSnapshot } from '../agent/transitService.js';
import { getRequiredAuthUser, requireSupabaseAuth } from '../auth/requireSupabaseAuth.js';
import { deleteUserSecret, findUserSecret, upsertUserSecret } from '../db/repositories/userSecretsRepo.js';
import { findUserByExternalId, upsertUser } from '../db/repositories/usersRepo.js';
import { encryptSecret } from '../security/secretsCrypto.js';

const upsertUserSchema = z.object({
  externalId: z.string().min(1),
  displayName: z.string().min(1).optional(),
  gender: z.union([z.literal(0), z.literal(1)]).optional(),
  birthSolarDatetime: z.string().datetime({ offset: true }).optional(),
  birthLunarDatetime: z.string().min(1).optional(),
  profile: z.record(z.unknown()).optional(),
});

export const usersRouter = Router();

const apiKeySchema = z.object({
  apiKey: z.string().min(20),
});

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

usersRouter.get('/me', requireSupabaseAuth, async (req, res) => {
  const authUser = getRequiredAuthUser(req);
  const user = await upsertUser({
    externalId: authUser.id,
    profileJson: authUser.email ? { authEmail: authUser.email } : undefined,
  });
  return res.json({ user });
});

usersRouter.get('/me/transit', requireSupabaseAuth, async (req, res) => {
  const authUser = getRequiredAuthUser(req);
  const user = await findUserByExternalId(authUser.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const transit = await getCurrentTransitSnapshot(user.gender === 0 || user.gender === 1 ? user.gender : null);
  return res.json({ userExternalId: authUser.id, transit });
});

usersRouter.get('/me/api-key', requireSupabaseAuth, async (req, res) => {
  const authUser = getRequiredAuthUser(req);
  const user = await findUserByExternalId(authUser.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const secret = await findUserSecret(user.id, 'openai');
  return res.json({
    provider: 'openai',
    hasKey: Boolean(secret),
    last4: secret?.secret_last4 ?? null,
  });
});

usersRouter.put('/me/api-key', requireSupabaseAuth, async (req, res) => {
  const parsed = apiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  const authUser = getRequiredAuthUser(req);
  const user = await upsertUser({
    externalId: authUser.id,
    profileJson: authUser.email ? { authEmail: authUser.email } : undefined,
  });
  const value = parsed.data.apiKey.trim();
  await upsertUserSecret({
    userId: user.id,
    provider: 'openai',
    encryptedSecret: encryptSecret(value),
    secretLast4: value.slice(-4),
  });
  return res.json({ ok: true, provider: 'openai', last4: value.slice(-4) });
});

usersRouter.delete('/me/api-key', requireSupabaseAuth, async (req, res) => {
  const authUser = getRequiredAuthUser(req);
  const user = await findUserByExternalId(authUser.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  await deleteUserSecret(user.id, 'openai');
  return res.json({ ok: true });
});

usersRouter.get('/:externalId', async (req, res) => {
  const externalId = req.params.externalId;
  const user = await findUserByExternalId(externalId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user });
});
