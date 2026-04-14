import type { QueryResult } from 'pg';
import { pool } from '../pool.js';
import type { DbChatSession } from '../types.js';

function mapRow(row: Record<string, unknown>): DbChatSession {
  return row as unknown as DbChatSession;
}

export async function createSession(userId: string, title?: string): Promise<DbChatSession> {
  const result: QueryResult = await pool.query(
    `
    INSERT INTO chat_sessions (user_id, title)
    VALUES ($1, $2)
    RETURNING *;
    `,
    [userId, title ?? null],
  );
  return mapRow(result.rows[0]);
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

export interface SessionSnapshotInput {
  displayName?: string | null;
  gender?: number | null;
  birthSolar?: string | null;
  baziJson?: unknown;
}

export async function updateSessionSnapshot(sessionId: string, snap: SessionSnapshotInput): Promise<void> {
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
      snap.displayName ?? null,
      snap.gender ?? null,
      snap.birthSolar ?? null,
      snap.baziJson ? JSON.stringify(snap.baziJson) : null,
    ],
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
  resolved_display_name: string | null;
  resolved_gender: unknown;
  resolved_birth_solar: unknown;
  resolved_bazi_json: unknown;
}

/** 按 external_id 列出会话，并与 users 行 JOIN */
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
      COALESCE(s.snapshot_display_name, u.display_name) AS resolved_display_name,
      COALESCE(s.snapshot_gender, u.gender) AS resolved_gender,
      COALESCE(s.snapshot_birth_solar, u.birth_solar_datetime::text) AS resolved_birth_solar,
      COALESCE(s.snapshot_bazi_json, u.bazi_json) AS resolved_bazi_json
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
