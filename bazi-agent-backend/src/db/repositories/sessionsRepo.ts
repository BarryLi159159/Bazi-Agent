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

export async function listSessionsByUserId(userId: string, limit = 20): Promise<SessionSummary[]> {
  const result: QueryResult = await pool.query(
    `
    SELECT
      s.id,
      s.user_id,
      s.title,
      s.created_at,
      s.updated_at,
      COUNT(m.id)::int AS message_count,
      (
        SELECT m2.content
        FROM messages m2
        WHERE m2.session_id = s.id
        ORDER BY m2.created_at DESC
        LIMIT 1
      ) AS last_message
    FROM chat_sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    WHERE s.user_id = $1
    GROUP BY s.id
    ORDER BY s.updated_at DESC
    LIMIT $2;
    `,
    [userId, limit],
  );

  return result.rows as unknown as SessionSummary[];
}
