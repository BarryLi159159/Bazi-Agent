export interface ChatMessage {
  id?: string;
  session_id?: string;
  user_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  meta_json?: Record<string, unknown>;
  created_at?: string;
}

export type StructurePattern = 'ordinary' | 'follow' | 'transform' | 'uncertain';
export type DayMasterStrength = 'weak' | 'balanced' | 'strong';
export type StabilityLevel = 'stable' | 'semi_stable' | 'fragile';
export type LuckEffectType = 'repair' | 'amplify_failure' | 'collapse_trigger' | 'mixed';

export interface StructuredAnalysis {
  questionSummary: string;
  chartBasis: {
    hasBazi: boolean;
    baziSource?: string;
    transitIncluded: boolean;
    transitGeneratedAt?: string;
  };
  reasoningSummary: string[];
  structureType: {
    pattern: StructurePattern;
    isExtreme: boolean;
    extremeNote: string;
    followAdjustment: string;
  };
  failure: {
    fiveElementImbalance: string[];
    clashes: string[];
    structuralBreaks: string[];
    primaryFailure: string;
  };
  rescue: {
    rescuable: boolean;
    rescueReason: string;
    candidateUsefulGods: string[];
  };
  capacity: {
    dayMasterStrength: DayMasterStrength;
    loadBearing: string;
    note: string;
  };
  usefulGods: {
    primary: string[];
    support: string[];
    rationale: string;
  };
  usefulGodEffectiveness: {
    rooted: boolean;
    constrained: boolean;
    combinedAway: boolean;
    sufficientForce: boolean;
    effective: boolean;
    reason: string;
  };
  stability: {
    level: StabilityLevel;
    positiveLoops: string[];
    weakPoints: string[];
  };
  preferences: {
    favorable: string[];
    unfavorable: string[];
    rationale: string;
  };
  failureMode: {
    collapseTriggers: string[];
    collapseCondition: string;
  };
  luckFlow: {
    effectType: LuckEffectType;
    evidence: string[];
    summary: string;
  };
  finalSummary: {
    coreProblem: string;
    solution: string;
    trajectoryImpact: string;
  };
  confidence: number;
}

export interface ChatResponseMeta {
  modelProvider: string;
  usedFallback: boolean;
  baziComputed: boolean;
  baziSource?: string;
}

export interface ChatResponse {
  userId: string;
  sessionId: string;
  assistantMessage: string;
  structured: StructuredAnalysis;
  meta: ChatResponseMeta;
  baziComputed: boolean;
  baziSource?: string;
}

export interface SessionHistoryResponse {
  sessionId: string;
  messages: ChatMessage[];
}

export interface SessionSummary {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string | null;
  last_message_preview?: string | null;
  /** 与当前用户档案一致；用于「记录」列表展示 */
  record_name?: string | null;
  record_gender?: number | null;
  record_birth_solar?: string | null;
  record_bazi?: string | null;
  record_zodiac?: string | null;
}

export interface SessionsResponse {
  userExternalId: string;
  sessions: SessionSummary[];
}

export interface TransitHiddenStem {
  slot: string;
  stem: string;
  tenGod: string;
}

export interface TransitLayer {
  key: 'year' | 'month' | 'day' | 'hour';
  ganZhi: string;
  stem: string;
  stemElement: string;
  stemYinYang: string;
  stemTenGod: string;
  branch: string;
  branchElement: string;
  branchYinYang: string;
  hiddenStems: TransitHiddenStem[];
  naYin: string;
  xun: string;
  kongWang: string;
  xingYun: string;
  ziZuo: string;
}

export interface TransitSnapshot {
  source: string;
  generatedAt: string;
  layers: TransitLayer[];
}

export interface TransitResponse {
  userExternalId: string;
  transit: TransitSnapshot;
}

export interface UserApiKeyStatus {
  provider: string;
  hasKey: boolean;
  last4: string | null;
}

export interface UserProfileForm {
  displayName: string;
  gender: 0 | 1 | null;
  birthSolarDatetime: string;
  birthLocation: string;
  currentAge: number | null;
  currentYear: number | null;
  chartValidationRecords: ChartValidationRecord[];
}

export interface ChartValidationRecord {
  year: number | null;
  eventType: string;
  polarity: 'good' | 'bad' | '';
  impactLevel: number | null;
}

export interface UserRecord {
  id: string;
  external_id: string;
  display_name: string | null;
  gender: number | null;
  birth_solar_datetime: string | null;
  birth_lunar_datetime: string | null;
  bazi_json: unknown;
  profile_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserResponse {
  user: UserRecord;
}
