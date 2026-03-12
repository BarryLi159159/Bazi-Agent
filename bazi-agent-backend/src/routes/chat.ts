import { Router } from 'express';
import { z } from 'zod';
import { BadRequestError, chatWithAgent } from '../agent/agentService.js';

const chatBodySchema = z.object({
  userExternalId: z.string().min(1),
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1),
  userProfile: z
    .object({
      displayName: z.string().min(1).optional(),
      gender: z.union([z.literal(0), z.literal(1)]).optional(),
      birthSolarDatetime: z.string().datetime({ offset: true }).optional(),
      birthLunarDatetime: z.string().min(1).optional(),
      extra: z.record(z.unknown()).optional(),
    })
    .optional(),
  baziInput: z
    .object({
      solarDatetime: z.string().datetime({ offset: true }).optional(),
      lunarDatetime: z.string().min(1).optional(),
      gender: z.union([z.literal(0), z.literal(1)]).optional(),
      eightCharProviderSect: z.union([z.literal(1), z.literal(2)]).optional(),
    })
    .optional(),
});

export const chatRouter = Router();

chatRouter.post('/', async (req, res) => {
  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
  }

  try {
    const result = await chatWithAgent(parsed.data);
    return res.json(result);
  } catch (error) {
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
});
