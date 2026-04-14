import { z } from 'zod';
import type { ChatRole } from '../db/types.js';

export interface BaziInput {
  solarDatetime?: string | undefined;
  lunarDatetime?: string | undefined;
  gender?: 0 | 1 | undefined;
  eightCharProviderSect?: 1 | 2 | undefined;
}

export interface BaziProvider {
  readonly name: string;
  getBaziDetail(input: BaziInput): Promise<unknown>;
}

export interface ModelMessage {
  role: ChatRole;
  content: string;
}

export const structurePatternSchema = z.enum(['ordinary', 'follow', 'transform', 'uncertain']);
export type StructurePattern = z.infer<typeof structurePatternSchema>;

export const dayMasterStrengthSchema = z.enum(['weak', 'balanced', 'strong']);
export type DayMasterStrength = z.infer<typeof dayMasterStrengthSchema>;

export const stabilityLevelSchema = z.enum(['stable', 'semi_stable', 'fragile']);
export type StabilityLevel = z.infer<typeof stabilityLevelSchema>;

export const luckEffectTypeSchema = z.enum(['repair', 'amplify_failure', 'collapse_trigger', 'mixed']);
export type LuckEffectType = z.infer<typeof luckEffectTypeSchema>;

export const evidenceSourceSchema = z.object({
  title: z.string().min(1).max(80),
  section: z.string().min(1).max(120),
  reason: z.string().min(1).max(160),
});
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;

export const structuredAnalysisSchema = z.object({
  questionSummary: z.string().min(1).max(200),
  chartBasis: z.object({
    hasBazi: z.boolean(),
    baziSource: z.string().optional(),
    transitIncluded: z.boolean(),
    transitGeneratedAt: z.string().optional(),
  }),
  reasoningSummary: z.array(z.string().min(1).max(120)).min(1).max(4),
  structureType: z.object({
    pattern: structurePatternSchema,
    isExtreme: z.boolean(),
    extremeNote: z.string().min(1).max(200),
    followAdjustment: z.string().min(1).max(200),
  }),
  failure: z.object({
    fiveElementImbalance: z.array(z.string().min(1).max(80)).max(5),
    clashes: z.array(z.string().min(1).max(120)).max(6),
    structuralBreaks: z.array(z.string().min(1).max(120)).max(6),
    primaryFailure: z.string().min(1).max(240),
  }),
  rescue: z.object({
    rescuable: z.boolean(),
    rescueReason: z.string().min(1).max(240),
    candidateUsefulGods: z.array(z.string().min(1).max(30)).max(5),
  }),
  capacity: z.object({
    dayMasterStrength: dayMasterStrengthSchema,
    loadBearing: z.string().min(1).max(200),
    note: z.string().min(1).max(200),
  }),
  usefulGods: z.object({
    primary: z.array(z.string().min(1).max(30)).min(1).max(4),
    support: z.array(z.string().min(1).max(30)).max(4),
    rationale: z.string().min(1).max(240),
  }),
  usefulGodEffectiveness: z.object({
    rooted: z.boolean(),
    constrained: z.boolean(),
    combinedAway: z.boolean(),
    sufficientForce: z.boolean(),
    effective: z.boolean(),
    reason: z.string().min(1).max(240),
  }),
  stability: z.object({
    level: stabilityLevelSchema,
    positiveLoops: z.array(z.string().min(1).max(120)).max(5),
    weakPoints: z.array(z.string().min(1).max(120)).max(5),
  }),
  preferences: z.object({
    favorable: z.array(z.string().min(1).max(30)).max(5),
    unfavorable: z.array(z.string().min(1).max(30)).max(5),
    rationale: z.string().min(1).max(240),
  }),
  failureMode: z.object({
    collapseTriggers: z.array(z.string().min(1).max(120)).max(5),
    collapseCondition: z.string().min(1).max(240),
  }),
  luckFlow: z.object({
    effectType: luckEffectTypeSchema,
    evidence: z.array(z.string().min(1).max(120)).max(5),
    summary: z.string().min(1).max(240),
  }),
  finalSummary: z.object({
    coreProblem: z.string().min(1).max(180),
    solution: z.string().min(1).max(180),
    trajectoryImpact: z.string().min(1).max(180),
  }),
  evidenceSources: z.array(evidenceSourceSchema).max(3).default([]),
  confidence: z.number().min(0).max(1),
  personalitySnapshot: z.object({
    headline: z.string().min(1).max(30),
    description: z.string().min(1).max(200),
    luckyColor: z.string().min(1).max(20),
    luckyDirection: z.string().min(1).max(20),
    yearKeyword: z.string().min(1).max(20),
  }).optional(),
  annualFortune: z.object({
    year: z.number(),
    score: z.number().min(0).max(100),
    summary: z.string().min(1).max(100),
  }).optional(),
});
export type StructuredAnalysis = z.infer<typeof structuredAnalysisSchema>;

export interface ChatResponseMeta {
  modelProvider: string;
  usedFallback: boolean;
  baziComputed: boolean;
  baziSource?: string | undefined;
  fallbackErrorCode?: string | undefined;
  fallbackErrorMessage?: string | undefined;
}

export interface ModelProvider {
  readonly name: string;
  generateStructuredAnalysis(messages: ModelMessage[]): Promise<StructuredAnalysis>;
  generateReply(messages: ModelMessage[]): Promise<string>;
}

export interface AgentChatInput {
  userExternalId: string;
  sessionId?: string | undefined;
  message: string;
  userProfile?: {
    displayName?: string | undefined;
    gender?: 0 | 1 | undefined;
    birthSolarDatetime?: string | undefined;
    birthLunarDatetime?: string | undefined;
    extra?: Record<string, unknown> | undefined;
  } | undefined;
  baziInput?: BaziInput | undefined;
}

export interface AgentChatResult {
  userId: string;
  sessionId: string;
  assistantMessage: string;
  structured: StructuredAnalysis;
  meta: ChatResponseMeta;
  baziComputed: boolean;
  baziSource?: string | undefined;
}
