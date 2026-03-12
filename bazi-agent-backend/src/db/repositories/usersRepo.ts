import type { QueryResult } from 'pg';
import { pool } from '../pool.js';
import type { DbUser } from '../types.js';

export interface UpsertUserInput {
  externalId: string;
  displayName?: string | undefined;
  gender?: number | undefined;
  birthSolarDatetime?: string | undefined;
  birthLunarDatetime?: string | undefined;
  baziJson?: unknown | undefined;
  profileJson?: Record<string, unknown> | undefined;
}

function mapRow(row: Record<string, unknown>): DbUser {
  return row as unknown as DbUser;
}

export async function upsertUser(input: UpsertUserInput): Promise<DbUser> {
  const result: QueryResult = await pool.query(
    `
    INSERT INTO users (
      external_id,
      display_name,
      gender,
      birth_solar_datetime,
      birth_lunar_datetime,
      bazi_json,
      profile_json
    ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::jsonb, '{}'::jsonb))
    ON CONFLICT (external_id) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, users.display_name),
      gender = COALESCE(EXCLUDED.gender, users.gender),
      birth_solar_datetime = COALESCE(EXCLUDED.birth_solar_datetime, users.birth_solar_datetime),
      birth_lunar_datetime = COALESCE(EXCLUDED.birth_lunar_datetime, users.birth_lunar_datetime),
      bazi_json = COALESCE(EXCLUDED.bazi_json, users.bazi_json),
      profile_json = users.profile_json || EXCLUDED.profile_json,
      updated_at = NOW()
    RETURNING *;
    `,
    [
      input.externalId,
      input.displayName ?? null,
      input.gender ?? null,
      input.birthSolarDatetime ?? null,
      input.birthLunarDatetime ?? null,
      input.baziJson ?? null,
      input.profileJson ? JSON.stringify(input.profileJson) : null,
    ],
  );

  return mapRow(result.rows[0]);
}

export async function findUserByExternalId(externalId: string): Promise<DbUser | null> {
  const result: QueryResult = await pool.query(
    `SELECT * FROM users WHERE external_id = $1 LIMIT 1;`,
    [externalId],
  );
  if (result.rowCount === 0) {
    return null;
  }
  return mapRow(result.rows[0]);
}

export async function updateUserBazi(userId: string, baziJson: unknown): Promise<DbUser> {
  const result: QueryResult = await pool.query(
    `
    UPDATE users
    SET bazi_json = $2::jsonb,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
    `,
    [userId, JSON.stringify(baziJson)],
  );

  return mapRow(result.rows[0]);
}
