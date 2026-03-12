import type { QueryResult } from 'pg';
import { pool } from '../pool.js';
import type { DbUserMemory } from '../types.js';

export interface CreateMemoryInput {
  userId: string;
  memoryType: string;
  content: string;
  sourceMessageId?: string;
}

function mapRow(row: Record<string, unknown>): DbUserMemory {
  return row as unknown as DbUserMemory;
}

export async function createMemory(input: CreateMemoryInput): Promise<DbUserMemory> {
  const result: QueryResult = await pool.query(
    `
    INSERT INTO user_memories (user_id, memory_type, content, source_message_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
    `,
    [input.userId, input.memoryType, input.content, input.sourceMessageId ?? null],
  );
  return mapRow(result.rows[0]);
}

export async function listRecentMemories(userId: string, limit = 8): Promise<DbUserMemory[]> {
  const result: QueryResult = await pool.query(
    `
    SELECT *
    FROM user_memories
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
    `,
    [userId, limit],
  );

  return result.rows.map((row) => mapRow(row));
}
