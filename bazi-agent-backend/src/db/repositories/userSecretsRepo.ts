import type { QueryResult } from 'pg';
import { pool } from '../pool.js';

export interface DbUserSecret {
  id: string;
  user_id: string;
  provider: string;
  encrypted_secret: string;
  secret_last4: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: Record<string, unknown>): DbUserSecret {
  return row as unknown as DbUserSecret;
}

export async function upsertUserSecret(params: {
  userId: string;
  provider: string;
  encryptedSecret: string;
  secretLast4: string;
}): Promise<DbUserSecret> {
  const result: QueryResult = await pool.query(
    `
    INSERT INTO user_secrets (user_id, provider, encrypted_secret, secret_last4)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, provider) DO UPDATE SET
      encrypted_secret = EXCLUDED.encrypted_secret,
      secret_last4 = EXCLUDED.secret_last4,
      updated_at = NOW()
    RETURNING *;
    `,
    [params.userId, params.provider, params.encryptedSecret, params.secretLast4],
  );
  return mapRow(result.rows[0]);
}

export async function findUserSecret(userId: string, provider: string): Promise<DbUserSecret | null> {
  const result: QueryResult = await pool.query(
    `
    SELECT *
    FROM user_secrets
    WHERE user_id = $1 AND provider = $2
    LIMIT 1;
    `,
    [userId, provider],
  );
  if ((result.rowCount ?? 0) === 0) {
    return null;
  }
  return mapRow(result.rows[0]);
}

export async function deleteUserSecret(userId: string, provider: string): Promise<boolean> {
  const result: QueryResult = await pool.query(
    `DELETE FROM user_secrets WHERE user_id = $1 AND provider = $2;`,
    [userId, provider],
  );
  return (result.rowCount ?? 0) > 0;
}
