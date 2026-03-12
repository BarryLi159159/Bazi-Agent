export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export interface ChatResponse {
  userId: string;
  sessionId: string;
  assistantMessage: string;
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
}

export interface SessionsResponse {
  userExternalId: string;
  sessions: SessionSummary[];
}

export interface UserProfileForm {
  userExternalId: string;
  displayName: string;
  gender: 0 | 1;
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
