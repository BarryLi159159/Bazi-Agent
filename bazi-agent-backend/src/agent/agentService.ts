import { config } from '../config.js';
import { createMemory, listRecentMemories } from '../db/repositories/memoriesRepo.js';
import { createMessage, listRecentMessagesBySession } from '../db/repositories/messagesRepo.js';
import { createSession, getSessionById, touchSession } from '../db/repositories/sessionsRepo.js';
import { findUserSecret } from '../db/repositories/userSecretsRepo.js';
import { upsertUser, updateUserBazi } from '../db/repositories/usersRepo.js';
import { decryptSecret } from '../security/secretsCrypto.js';
import { buildBaziProviders } from './baziProviders.js';
import { hasChartRich, hasMissingFortuneCycles, mergeFortuneFromSupplement, normalizeBaziRecord } from './chartRich.js';
import { extractMemoriesFromUserText } from './memoryExtractor.js';
import { createModelProvider, RuleBasedModelProvider } from './modelProvider.js';
import { buildAnalysisSystemPrompt, buildAnswerSystemPrompt, mapConversationMessages } from './prompts.js';
import { getCurrentTransitSnapshot } from './transitService.js';
import type { AgentChatInput, AgentChatResult, BaziInput, ModelMessage, StructuredAnalysis } from './types.js';

export class BadRequestError extends Error {}

const baziProviders = buildBaziProviders();

async function resolveUserOpenAiKey(userId: string): Promise<string | null> {
  const secret = await findUserSecret(userId, 'openai');
  if (!secret) {
    return null;
  }
  try {
    return decryptSecret(secret.encrypted_secret);
  } catch (error) {
    console.warn('[UserSecret] failed to decrypt OpenAI key', error);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractStoredBaziSource(bazi: unknown): string | undefined {
  if (!isRecord(bazi)) {
    return undefined;
  }
  const chart = isRecord(bazi['chart_rich']) ? bazi['chart_rich'] : null;
  const source = chart?.['source'];
  return typeof source === 'string' && source.trim().length > 0 ? source : undefined;
}

function enrichStructuredAnalysis(
  analysis: StructuredAnalysis,
  options: {
    hasBazi: boolean;
    baziSource?: string | undefined;
    transitGeneratedAt?: string | undefined;
  },
): StructuredAnalysis {
  const chartBasis: StructuredAnalysis['chartBasis'] = {
    ...analysis.chartBasis,
    hasBazi: options.hasBazi,
    transitIncluded: Boolean(options.transitGeneratedAt),
  };

  if (options.baziSource) {
    chartBasis.baziSource = options.baziSource;
  }

  if (options.transitGeneratedAt) {
    chartBasis.transitGeneratedAt = options.transitGeneratedAt;
  }

  return {
    ...analysis,
    chartBasis,
  };
}

function createSessionTitle(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  return trimmed.slice(0, 24) || '新会话';
}

function resolveBaziInput(input: AgentChatInput): BaziInput | undefined {
  const provided = input.baziInput;
  const fromProfile = input.userProfile;

  const merged: BaziInput = {
    solarDatetime: provided?.solarDatetime ?? fromProfile?.birthSolarDatetime,
    lunarDatetime: provided?.lunarDatetime ?? fromProfile?.birthLunarDatetime,
    gender: provided?.gender ?? fromProfile?.gender,
    eightCharProviderSect: provided?.eightCharProviderSect ?? 2,
  };

  if (!merged.solarDatetime && !merged.lunarDatetime) {
    return undefined;
  }

  return merged;
}

function resolveStoredBaziInputFromUser(input: BaziInput | undefined, user: { birth_solar_datetime: string | null; birth_lunar_datetime: string | null; gender: number | null }): BaziInput | undefined {
  if (input?.solarDatetime || input?.lunarDatetime) {
    return input;
  }

  if (!user.birth_solar_datetime && !user.birth_lunar_datetime) {
    return input;
  }

  return {
    solarDatetime: user.birth_solar_datetime ?? undefined,
    lunarDatetime: user.birth_lunar_datetime ?? undefined,
    gender: user.gender === 0 || user.gender === 1 ? user.gender : undefined,
    eightCharProviderSect: input?.eightCharProviderSect ?? 2,
  };
}

export async function chatWithAgent(input: AgentChatInput): Promise<AgentChatResult> {
  const user = await upsertUser({
    externalId: input.userExternalId,
    displayName: input.userProfile?.displayName,
    gender: input.userProfile?.gender,
    birthSolarDatetime: input.userProfile?.birthSolarDatetime,
    birthLunarDatetime: input.userProfile?.birthLunarDatetime,
    profileJson: input.userProfile?.extra,
  });

  const session = input.sessionId
    ? await getSessionById(input.sessionId)
    : await createSession(user.id, createSessionTitle(input.message));

  if (!session) {
    throw new BadRequestError('sessionId 不存在');
  }

  if (session.user_id !== user.id) {
    throw new BadRequestError('sessionId 不属于该用户');
  }

  const userMessage = await createMessage({
    sessionId: session.id,
    userId: user.id,
    role: 'user',
    content: input.message,
  });

  if (config.AUTO_EXTRACT_MEMORY) {
    const drafts = extractMemoriesFromUserText(input.message);
    for (const draft of drafts) {
      await createMemory({
        userId: user.id,
        memoryType: draft.memoryType,
        content: draft.content,
        sourceMessageId: userMessage.id,
      });
    }
  }

  let activeUser = user;
  let baziComputed = false;
  let baziSource: string | undefined;
  const requestedBaziInput = resolveBaziInput(input);
  const baziInput = resolveStoredBaziInputFromUser(requestedBaziInput, activeUser);
  const hasExplicitBaziRequest = Boolean(requestedBaziInput?.solarDatetime || requestedBaziInput?.lunarDatetime);

  const existingBaziRecord = isRecord(activeUser.bazi_json) ? activeUser.bazi_json : null;
  const hasStructuredChart = Boolean(existingBaziRecord && hasChartRich(existingBaziRecord));
  const missingFortuneCycles = Boolean(existingBaziRecord && hasMissingFortuneCycles(existingBaziRecord));
  const pythonProvider = baziProviders.find((provider) => provider.name === 'bazi-master-python');

  if (baziInput && (hasExplicitBaziRequest || !activeUser.bazi_json || !hasStructuredChart || missingFortuneCycles)) {
    let lastBaziError: unknown;
    for (const provider of baziProviders) {
      try {
        const baziData = await provider.getBaziDetail(baziInput);
        let normalizedBaziData = normalizeBaziRecord(baziData, provider.name);

        // Keep bazi-mcp as primary source, only backfill fortune cycles from python when needed.
        if (provider.name === 'bazi-mcp-local-dist' && hasMissingFortuneCycles(normalizedBaziData) && pythonProvider && baziInput.solarDatetime) {
          try {
            const supplementData = await pythonProvider.getBaziDetail(baziInput);
            const normalizedSupplement = normalizeBaziRecord(supplementData, pythonProvider.name);
            normalizedBaziData = mergeFortuneFromSupplement(normalizedBaziData, normalizedSupplement);
          } catch (supplementError) {
            console.warn('[BaziProvider] python supplement for fortune cycles failed', supplementError);
          }
        }

        activeUser = await updateUserBazi(activeUser.id, normalizedBaziData);
        baziComputed = true;
        baziSource = provider.name;
        await createMemory({
          userId: activeUser.id,
          memoryType: 'bazi',
          content: `已完成八字排盘（来源：${provider.name}）`,
          sourceMessageId: userMessage.id,
        });
        break;
      } catch (error) {
        lastBaziError = error;
        console.warn(`[BaziProvider] ${provider.name} failed`, error);
      }
    }

    if (!baziComputed && !activeUser.bazi_json) {
      const detail = lastBaziError instanceof Error ? `: ${lastBaziError.message}` : '';
      throw new BadRequestError(`八字排盘失败${detail}`);
    }
  }

  const [recentMessages, memories, transit] = await Promise.all([
    listRecentMessagesBySession(session.id, 12),
    listRecentMemories(activeUser.id, 8),
    getCurrentTransitSnapshot(activeUser.gender === 0 || activeUser.gender === 1 ? activeUser.gender : null).catch((error) => {
      console.warn('[Transit] failed to load current transit snapshot', error);
      return null;
    }),
  ]);

  const analysisSystemPrompt = buildAnalysisSystemPrompt({
    user: activeUser,
    memories,
    baziData: activeUser.bazi_json,
    transitData: transit,
  });

  const analysisMessages: ModelMessage[] = [
    { role: 'system', content: analysisSystemPrompt },
    ...mapConversationMessages(recentMessages),
  ];

  const modelProvider = createModelProvider(await resolveUserOpenAiKey(activeUser.id));
  let assistantMessage = '';
  let structured: StructuredAnalysis;
  let usedModelName = modelProvider.name;
  let usedFallback = false;

  try {
    structured = enrichStructuredAnalysis(await modelProvider.generateStructuredAnalysis(analysisMessages), {
      hasBazi: Boolean(activeUser.bazi_json),
      baziSource: baziSource ?? extractStoredBaziSource(activeUser.bazi_json),
      transitGeneratedAt: transit?.generatedAt,
    });
    assistantMessage = await modelProvider.generateReply([
      { role: 'system', content: buildAnswerSystemPrompt({ user: activeUser, analysis: structured }) },
      { role: 'user', content: input.message },
    ]);
  } catch (error) {
    console.warn(`[ModelProvider] ${modelProvider.name} failed, fallback to rules`, error);
    const fallback = new RuleBasedModelProvider();
    structured = enrichStructuredAnalysis(await fallback.generateStructuredAnalysis(analysisMessages), {
      hasBazi: Boolean(activeUser.bazi_json),
      baziSource: baziSource ?? extractStoredBaziSource(activeUser.bazi_json),
      transitGeneratedAt: transit?.generatedAt,
    });
    assistantMessage = await fallback.generateReply([
      { role: 'system', content: buildAnswerSystemPrompt({ user: activeUser, analysis: structured }) },
      { role: 'user', content: input.message },
    ]);
    usedModelName = fallback.name;
    usedFallback = true;
  }

  await createMessage({
    sessionId: session.id,
    userId: activeUser.id,
    role: 'assistant',
    content: assistantMessage,
    metaJson: {
      modelProvider: usedModelName,
      usedFallback,
      baziSource,
      baziComputed,
      structured,
      transitGeneratedAt: transit?.generatedAt ?? null,
    },
  });

  await touchSession(session.id);

  return {
    userId: activeUser.id,
    sessionId: session.id,
    assistantMessage,
    structured,
    meta: {
      modelProvider: usedModelName,
      usedFallback,
      baziComputed,
      baziSource,
    },
    baziComputed,
    baziSource,
  };
}
