import type { QueryResult } from 'pg';
import { pool } from '../pool.js';

export interface DbPrediction {
  id: string;
  user_id: string;
  year_start: number;
  year_end: number;
  prediction_json: unknown;
  model_provider: string | null;
  created_at: string;
}

export async function findPrediction(userId: string, yearStart: number, yearEnd: number): Promise<DbPrediction | null> {
  const result: QueryResult = await pool.query(
    `SELECT * FROM predictions WHERE user_id = $1 AND year_start = $2 AND year_end = $3 LIMIT 1;`,
    [userId, yearStart, yearEnd],
  );
  return (result.rows[0] as DbPrediction | undefined) ?? null;
}

export async function upsertPrediction(params: {
  userId: string;
  yearStart: number;
  yearEnd: number;
  predictionJson: unknown;
  modelProvider: string | null;
}): Promise<DbPrediction> {
  const result: QueryResult = await pool.query(
    `
    INSERT INTO predictions (user_id, year_start, year_end, prediction_json, model_provider)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, year_start, year_end)
    DO UPDATE SET prediction_json = EXCLUDED.prediction_json,
                  model_provider  = EXCLUDED.model_provider,
                  created_at      = now()
    RETURNING *;
    `,
    [params.userId, params.yearStart, params.yearEnd, JSON.stringify(params.predictionJson), params.modelProvider],
  );
  return result.rows[0] as DbPrediction;
}
