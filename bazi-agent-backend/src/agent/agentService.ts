import { existsSync } from 'node:fs';

import { config } from '../config.js';
import { createMemory, listRecentMemories } from '../db/repositories/memoriesRepo.js';
import { createMessage, listRecentMessagesBySession } from '../db/repositories/messagesRepo.js';
import { createSession, getSessionById, touchSession, updateSessionSnapshot } from '../db/repositories/sessionsRepo.js';
import { findUserSecret } from '../db/repositories/userSecretsRepo.js';
import { upsertUser, updateUserBazi } from '../db/repositories/usersRepo.js';
import { decryptSecret } from '../security/secretsCrypto.js';
import { buildBaziProviders } from './baziProviders.js';
import { hasChartRich, hasMissingFortuneCycles, mergeFortuneFromSupplement, normalizeBaziRecord } from './chartRich.js';
import { extractMemoriesFromUserText } from './memoryExtractor.js';
import { createModelProvider, RuleBasedModelProvider } from './modelProvider.js';
import { mapBookSourceToTitle, normalizeBookSectionLabel, retrieveBookRagSnippets } from './rag/bookRag.js';
import { classifyTopic } from './rag/topicRouter.js';
import {
  buildAnalysisSystemPrompt,
  buildAnswerSystemPrompt,
  buildBookRagQueryText,
  buildLlmContextJson,
  mapConversationMessages,
} from './prompts.js';
import { getCurrentTransitSnapshot } from './transitService.js';
import type { AgentChatInput, AgentChatResult, BaziInput, EvidenceSource, ModelMessage, StructuredAnalysis } from './types.js';

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
    evidenceSources?: EvidenceSource[] | undefined;
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

  const evidenceSources = options.evidenceSources && options.evidenceSources.length > 0 ? options.evidenceSources : analysis.evidenceSources;

  return {
    ...analysis,
    chartBasis,
    evidenceSources,
  };
}

function buildEvidenceSourcesFromRagSnippets(
  snippets: Array<{ source: string; heading: string; matchedKeywords: string[] }>,
): EvidenceSource[] {
  const sources: EvidenceSource[] = [];
  const seen = new Set<string>();

  for (const snippet of snippets) {
    const title = mapBookSourceToTitle(snippet.source);
    const section = normalizeBookSectionLabel(snippet.heading);
    const dedupeKey = `${title}::${section}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    const keywords = snippet.matchedKeywords.slice(0, 3);
    const reason =
      keywords.length > 0
        ? `该段与本次判断重点相关，命中关键词：${keywords.join('、')}。`
        : '该段与本次命盘判断主题接近，可作为参考依据。';

    sources.push({
      title,
      section,
      reason,
    });

    if (sources.length >= 3) {
      break;
    }
  }

  return sources;
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

function buildExportJsonPayload(params: {
  user: {
    display_name: string | null;
    gender: number | null;
    birth_solar_datetime: string | null;
    birth_lunar_datetime: string | null;
    profile_json: Record<string, unknown>;
    bazi_json: unknown;
  };
  structured: StructuredAnalysis;
  transit: unknown;
  userMessage: string;
  llmContextJson: Record<string, unknown>;
  analysisSystemPrompt: string;
  answerSystemPrompt: string;
  bookRagSnippets?: Array<{ source: string; title: string; heading: string; section: string; score: number; matchedKeywords: string[]; textPreview: string }>;
}): Record<string, unknown> {
  const profile = isRecord(params.user.profile_json) ? params.user.profile_json : {};
  const bazi = isRecord(params.user.bazi_json) ? params.user.bazi_json : null;
  const chartRich = isRecord(bazi?.['chart_rich']) ? bazi['chart_rich'] : null;
  const relations = isRecord(chartRich?.['relations']) ? chartRich['relations'] : null;
  const fortune = isRecord(chartRich?.['fortune']) ? chartRich['fortune'] : null;

  return {
    pipeline: params.structured,
    profile: {
      displayName: params.user.display_name,
      gender: params.user.gender,
      birthSolarDatetime: params.user.birth_solar_datetime,
      birthLunarDatetime: params.user.birth_lunar_datetime,
      birthLocation: profile['birthLocation'] ?? null,
      currentAge: profile['currentAge'] ?? null,
      currentYear: profile['currentYear'] ?? null,
      chartValidationRecords: profile['chartValidationRecords'] ?? [],
    },
    chart: chartRich
      ? {
          source: chartRich['source'] ?? null,
          provider: chartRich['provider'] ?? null,
          generatedAt: chartRich['generatedAt'] ?? null,
          basic: chartRich['basic'] ?? null,
          pillars: chartRich['pillars'] ?? null,
          fiveElements: chartRich['fiveElements'] ?? null,
          gods: chartRich['gods'] ?? null,
          relations: {
            highlights: relations?.['highlights'] ?? [],
            raw: relations?.['raw'] ?? null,
          },
        }
      : null,
    fortune: fortune
      ? {
          startDate: fortune['startDate'] ?? null,
          startAge: fortune['startAge'] ?? null,
          list: fortune['list'] ?? [],
          decades: fortune['decades'] ?? [],
        }
      : null,
    transit: params.transit ?? null,
    prompt: {
      userQuestion: params.userMessage,
      llmContextJson: params.llmContextJson,
      analysisSystemPrompt: params.analysisSystemPrompt,
      answerSystemPrompt: params.answerSystemPrompt,
      ...(params.bookRagSnippets?.length
        ? {
            bookRagSnippets: params.bookRagSnippets,
          }
        : {}),
    },
  };
}

function summarizeModelFailure(error: unknown): {
  fallbackErrorCode?: string;
  fallbackErrorMessage?: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('insufficient_quota')) {
    return {
      fallbackErrorCode: 'insufficient_quota',
      fallbackErrorMessage: 'quota exceeded',
    };
  }

  if (normalized.includes('invalid_api_key') || normalized.includes('incorrect api key')) {
    return {
      fallbackErrorCode: 'invalid_api_key',
      fallbackErrorMessage: 'auth failed',
    };
  }

  if (normalized.includes('authentication') || normalized.includes('unauthorized') || normalized.includes('401')) {
    return {
      fallbackErrorCode: 'auth_error',
      fallbackErrorMessage: 'auth failed',
    };
  }

  if (normalized.includes('429')) {
    return {
      fallbackErrorCode: 'rate_limit',
      fallbackErrorMessage: 'rate limit reached',
    };
  }

  return {
    fallbackErrorCode: 'provider_error',
    fallbackErrorMessage: message.slice(0, 200),
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

  const isNewSession = !input.sessionId;
  const session = isNewSession
    ? await createSession({
        userId: user.id,
        title: createSessionTitle(input.message),
        snapshotDisplayName: user.display_name,
        snapshotGender: user.gender,
        snapshotBirthSolar: user.birth_solar_datetime ? new Date(user.birth_solar_datetime).toISOString() : null,
        snapshotBaziJson: user.bazi_json,
      })
    : await getSessionById(input.sessionId!);

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

    if (baziComputed && isNewSession) {
      await updateSessionSnapshot(session.id, {
        displayName: activeUser.display_name,
        gender: activeUser.gender,
        birthSolar: activeUser.birth_solar_datetime ? new Date(activeUser.birth_solar_datetime).toISOString() : null,
        baziJson: activeUser.bazi_json,
      });
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

  const llmContextJson = buildLlmContextJson({
    user: activeUser,
    memories,
    baziData: activeUser.bazi_json,
    transitData: transit,
  });

  const ragTopic = classifyTopic(input.message);
  const bookRagQueryText = buildBookRagQueryText(activeUser.bazi_json, input.message);
  let bookRagSnippets: Awaited<ReturnType<typeof retrieveBookRagSnippets>> = [];
  if (config.BOOK_RAG_ENABLED && existsSync(config.BAZI_BOOKS_PATH) && bookRagQueryText.trim().length > 0) {
    try {
      bookRagSnippets = await retrieveBookRagSnippets({
        booksPath: config.BAZI_BOOKS_PATH,
        queryText: bookRagQueryText,
        topK: config.BOOK_RAG_TOP_K,
        minScore: config.BOOK_RAG_MIN_SCORE,
        topic: ragTopic,
      });
    } catch (error) {
      console.warn('[BookRAG] retrieve failed', error);
    }
  }

  const evidenceSources = buildEvidenceSourcesFromRagSnippets(bookRagSnippets);

  const analysisSystemPrompt = buildAnalysisSystemPrompt({
    user: activeUser,
    memories,
    baziData: activeUser.bazi_json,
    transitData: transit,
    ...(bookRagSnippets.length > 0 ? { bookRagSnippets } : {}),
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
  let fallbackDetails: { fallbackErrorCode?: string; fallbackErrorMessage?: string } = {};
  let answerSystemPrompt = '';

  try {
    structured = enrichStructuredAnalysis(await modelProvider.generateStructuredAnalysis(analysisMessages), {
      hasBazi: Boolean(activeUser.bazi_json),
      baziSource: baziSource ?? extractStoredBaziSource(activeUser.bazi_json),
      transitGeneratedAt: transit?.generatedAt,
      evidenceSources,
    });
    answerSystemPrompt = buildAnswerSystemPrompt({ user: activeUser, analysis: structured });
    assistantMessage = await modelProvider.generateReply([
      { role: 'system', content: answerSystemPrompt },
      { role: 'user', content: input.message },
    ]);
  } catch (error) {
    console.warn(`[ModelProvider] ${modelProvider.name} failed, fallback to rules`, error);
    fallbackDetails = summarizeModelFailure(error);
    const fallback = new RuleBasedModelProvider();
    structured = enrichStructuredAnalysis(await fallback.generateStructuredAnalysis(analysisMessages), {
      hasBazi: Boolean(activeUser.bazi_json),
      baziSource: baziSource ?? extractStoredBaziSource(activeUser.bazi_json),
      transitGeneratedAt: transit?.generatedAt,
      evidenceSources,
    });
    answerSystemPrompt = buildAnswerSystemPrompt({ user: activeUser, analysis: structured });
    assistantMessage = await fallback.generateReply([
      { role: 'system', content: answerSystemPrompt },
      { role: 'user', content: input.message },
    ]);
    usedModelName = fallback.name;
    usedFallback = true;
  }

  const exportJson = buildExportJsonPayload({
    user: activeUser,
    structured,
    transit,
    userMessage: input.message,
    llmContextJson,
    analysisSystemPrompt,
    answerSystemPrompt,
    ...(bookRagSnippets.length > 0
      ? {
          bookRagSnippets: bookRagSnippets.map((s) => ({
            source: s.source,
            title: mapBookSourceToTitle(s.source),
            heading: s.heading,
            section: normalizeBookSectionLabel(s.heading),
            score: s.score,
            matchedKeywords: s.matchedKeywords,
            textPreview: s.text.length > 500 ? `${s.text.slice(0, 500)}…` : s.text,
          })),
        }
      : {}),
  });

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
      exportJson,
      transitGeneratedAt: transit?.generatedAt ?? null,
      fallbackErrorCode: fallbackDetails.fallbackErrorCode ?? null,
      fallbackErrorMessage: fallbackDetails.fallbackErrorMessage ?? null,
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
      fallbackErrorCode: fallbackDetails.fallbackErrorCode,
      fallbackErrorMessage: fallbackDetails.fallbackErrorMessage,
    },
    baziComputed,
    baziSource,
  };
}
