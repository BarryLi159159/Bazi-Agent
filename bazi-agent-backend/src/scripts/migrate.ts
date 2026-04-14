import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/pool.js';

async function main(): Promise<void> {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = resolve(currentDir, '../../migrations');
  const files = ['001_init.sql', '002_drop_session_snapshot_columns.sql', '003_create_user_secrets.sql', '004_create_predictions.sql'];

  await pool.query('BEGIN');
  try {
    for (const file of files) {
      const migrationPath = resolve(migrationsDir, file);
      const sql = await readFile(migrationPath, 'utf8');
      await pool.query(sql);
      console.log('Migration applied:', migrationPath);
    }
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
