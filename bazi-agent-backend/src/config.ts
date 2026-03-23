import 'dotenv/config';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url().optional(),
  APP_SECRETS_KEY: z.string().min(32).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().min(1).default('gpt-4.1-mini'),
  BAZI_MCP_DIST_PATH: z.string().default('../bazi-mcp-dev/dist/index.js'),
  BAZI_MASTER_SCRIPT_PATH: z.string().default('../bazi-master/bazi.py'),
  BAZI_MASTER_PYTHON_BIN: z.string().default('python3'),
  AUTO_EXTRACT_MEMORY: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() === 'true'),
});

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, '..');

function resolveFromProjectRoot(pathValue: string): string {
  if (isAbsolute(pathValue)) {
    return pathValue;
  }
  return resolve(projectRoot, pathValue);
}

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  PROJECT_ROOT: projectRoot,
  BAZI_MCP_DIST_PATH: resolveFromProjectRoot(parsed.data.BAZI_MCP_DIST_PATH),
  BAZI_MASTER_SCRIPT_PATH: resolveFromProjectRoot(parsed.data.BAZI_MASTER_SCRIPT_PATH),
};
