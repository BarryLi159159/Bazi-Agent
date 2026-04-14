-- Re-add per-session snapshot so that each chart keeps its own profile data
-- instead of all sessions sharing the latest user row.
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS snapshot_display_name TEXT;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS snapshot_gender SMALLINT;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS snapshot_birth_solar TIMESTAMPTZ;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS snapshot_bazi_json JSONB;
