import type { QueryResult } from 'pg';
import { pool } from '../pool.js';
import type { ChatRole, DbMessage } from '../types.js';

export interface CreateMessageInput {
  sessionId: string;
  userId: string;
  role: ChatRole;
  content: string;
  metaJson?: Record<string, unknown>;
}

function mapRow(row: Record<string, unknown>): DbMessage {
  return row as unknown as DbMessage;
}

export async function createMessage(input: CreateMessageInput): Promise<DbMessage> {
  const result: QueryResult = await pool.query(
    `
    INSERT INTO messages (session_id, user_id, role, content, meta_json)
    VALUES ($1, $2, $3, $4, COALESCE($5::jsonb, '{}'::jsonb))
    RETURNING *;
    `,
    [input.sessionId, input.userId, input.role, input.content, input.metaJson ? JSON.stringify(input.metaJson) : null],
  );
  return mapRow(result.rows[0]);
}

export async function listMessagesBySession(sessionId: string, limit = 30): Promise<DbMessage[]> {
  const result: QueryResult = await pool.query(
    `
    SELECT *
    FROM messages
    WHERE session_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
    `,
    [sessionId, limit],
  );

  return result.rows.reverse().map((row) => mapRow(row));
}

export async function listRecentMessagesBySession(sessionId: string, limit = 12): Promise<DbMessage[]> {
  return listMessagesBySession(sessionId, limit);
}
