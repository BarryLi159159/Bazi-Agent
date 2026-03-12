import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/pool.js';

async function main(): Promise<void> {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const migrationPath = resolve(currentDir, '../../migrations/001_init.sql');
  const sql = await readFile(migrationPath, 'utf8');

  await pool.query('BEGIN');
  try {
    await pool.query(sql);
    await pool.query('COMMIT');
    console.log('Migration applied:', migrationPath);
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
