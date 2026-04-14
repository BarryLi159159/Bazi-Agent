ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS snapshot_display_name TEXT;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS snapshot_gender SMALLINT;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS snapshot_birth_solar TEXT;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS snapshot_bazi_json JSONB;
