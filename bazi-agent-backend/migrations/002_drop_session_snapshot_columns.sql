-- 若曾添加会话快照列，此处移除（列表数据统一从 users / bazi_json 读取）
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS snapshot_display_name;
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS snapshot_gender;
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS snapshot_birth_solar;
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS snapshot_bazi;
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS snapshot_zodiac;
