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

export interface ModelProvider {
  readonly name: string;
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
  baziComputed: boolean;
  baziSource?: string | undefined;
}
