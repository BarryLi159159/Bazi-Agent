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

export const chatIntentSchema = z.enum(['general', 'career', 'relationship', 'wealth', 'health', 'study']);
export type ChatIntent = z.infer<typeof chatIntentSchema>;

export const analysisSignalSchema = z.enum(['low', 'medium', 'high']);
export type AnalysisSignal = z.infer<typeof analysisSignalSchema>;

export const structuredTimeWindowSchema = z.object({
  label: z.string().min(1).max(40),
  signal: analysisSignalSchema,
  note: z.string().min(1).max(200),
});
export type StructuredTimeWindow = z.infer<typeof structuredTimeWindowSchema>;

export const structuredAnalysisSchema = z.object({
  intent: chatIntentSchema,
  questionSummary: z.string().min(1).max(200),
  chartBasis: z.object({
    hasBazi: z.boolean(),
    baziSource: z.string().optional(),
    transitIncluded: z.boolean(),
    transitGeneratedAt: z.string().optional(),
  }),
  reasoningSummary: z.array(z.string().min(1).max(120)).min(1).max(4),
  analysis: z.object({
    coreThemes: z.array(z.string().min(1).max(40)).min(1).max(4),
    timeWindows: z.array(structuredTimeWindowSchema).max(4),
    risks: z.array(z.string().min(1).max(120)).max(4),
    advice: z.array(z.string().min(1).max(160)).min(1).max(5),
  }),
  confidence: z.number().min(0).max(1),
});
export type StructuredAnalysis = z.infer<typeof structuredAnalysisSchema>;

export interface ChatResponseMeta {
  modelProvider: string;
  usedFallback: boolean;
  baziComputed: boolean;
  baziSource?: string | undefined;
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
