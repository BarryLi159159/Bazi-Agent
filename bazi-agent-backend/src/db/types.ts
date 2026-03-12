export type ChatRole = 'system' | 'user' | 'assistant';

export interface DbUser {
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

export interface DbChatSession {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  meta_json: Record<string, unknown>;
  created_at: string;
}

export interface DbUserMemory {
  id: string;
  user_id: string;
  memory_type: string;
  content: string;
  source_message_id: string | null;
  created_at: string;
}
