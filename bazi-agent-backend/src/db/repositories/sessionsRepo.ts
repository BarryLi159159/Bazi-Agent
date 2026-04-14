import type { QueryResult } from 'pg';
import { pool } from '../pool.js';
import type { DbChatSession } from '../types.js';

function mapRow(row: Record<string, unknown>): DbChatSession {
  return row as unknown as DbChatSession;
}

export interface CreateSessionOpts {
  userId: string;
  title?: string;
  snapshotDisplayName?: string | null;
  snapshotGender?: number | null;
  snapshotBirthSolar?: string | null;
  snapshotBaziJson?: unknown;
}

export async function createSession(opts: CreateSessionOpts): Promise<DbChatSession> {
  const result: QueryResult = await pool.query(
    `
    INSERT INTO chat_sessions (user_id, title, snapshot_display_name, snapshot_gender, snapshot_birth_solar, snapshot_bazi_json)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
    `,
    [
      opts.userId,
      opts.title ?? null,
      opts.snapshotDisplayName ?? null,
      opts.snapshotGender ?? null,
      opts.snapshotBirthSolar ?? null,
      opts.snapshotBaziJson ? JSON.stringify(opts.snapshotBaziJson) : null,
    ],
  );
  return mapRow(result.rows[0]);
}

export async function updateSessionSnapshot(sessionId: string, snapshot: {
  displayName?: string | null;
  gender?: number | null;
  birthSolar?: string | null;
  baziJson?: unknown;
}): Promise<void> {
  await pool.query(
    `
    UPDATE chat_sessions
    SET snapshot_display_name = COALESCE($2, snapshot_display_name),
        snapshot_gender       = COALESCE($3, snapshot_gender),
        snapshot_birth_solar  = COALESCE($4, snapshot_birth_solar),
        snapshot_bazi_json    = COALESCE($5, snapshot_bazi_json)
    WHERE id = $1;
    `,
    [
      sessionId,
      snapshot.displayName ?? null,
      snapshot.gender ?? null,
      snapshot.birthSolar ?? null,
      snapshot.baziJson ? JSON.stringify(snapshot.baziJson) : null,
    ],
  );
}

export async function getSessionById(sessionId: string): Promise<DbChatSession | null> {
  const result: QueryResult = await pool.query(
    `SELECT * FROM chat_sessions WHERE id = $1 LIMIT 1;`,
    [sessionId],
  );
  if (result.rowCount === 0) {
    return null;
  }
  return mapRow(result.rows[0]);
}

export async function touchSession(sessionId: string): Promise<void> {
  await pool.query(
    `
    UPDATE chat_sessions
    SET updated_at = NOW()
    WHERE id = $1;
    `,
    [sessionId],
  );
}

export async function deleteSessionById(sessionId: string): Promise<boolean> {
  const result: QueryResult = await pool.query(`DELETE FROM chat_sessions WHERE id = $1;`, [sessionId]);
  return (result.rowCount ?? 0) > 0;
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

/** 列表查询 JOIN users，字段与 SessionSummary 一致并附带 user_* */
export interface SessionListRow {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string | null;
  user_display_name: string | null;
  user_gender: unknown;
  user_birth_solar_datetime: unknown;
  user_bazi_json: unknown;
}

/** 按 external_id 列出会话，优先使用 session 快照，回退到 user 行 */
export async function listSessionsByExternalId(externalId: string, limit = 20): Promise<SessionListRow[]> {
  const result: QueryResult = await pool.query(
    `
    SELECT
      s.id,
      s.user_id,
      s.title,
      s.created_at,
      s.updated_at,
      (SELECT COUNT(*)::int FROM messages m WHERE m.session_id = s.id) AS message_count,
      (
        SELECT m2.content
        FROM messages m2
        WHERE m2.session_id = s.id
        ORDER BY m2.created_at DESC
        LIMIT 1
      ) AS last_message,
      COALESCE(s.snapshot_display_name, u.display_name) AS user_display_name,
      COALESCE(s.snapshot_gender, u.gender) AS user_gender,
      COALESCE(s.snapshot_birth_solar, u.birth_solar_datetime) AS user_birth_solar_datetime,
      COALESCE(s.snapshot_bazi_json, u.bazi_json) AS user_bazi_json
    FROM chat_sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE u.external_id = $1
    ORDER BY s.updated_at DESC
    LIMIT $2;
    `,
    [externalId, limit],
  );

  return result.rows as unknown as SessionListRow[];
}
