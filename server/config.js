import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, '..');
export const TEMPLATES_DIR = path.join(ROOT_DIR, 'templates');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const DATA_DIR = path.join(ROOT_DIR, '.data');

/**
 * Minimal .env loader. Avoids a dotenv dependency for a single small file.
 * Real environment variables always win over the file.
 */
function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

export const PORT = Number(process.env.PORT || 3000);
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'prelegal.db');
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
export const MODEL = process.env.PRELEGAL_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

/**
 * Force mock mode with PRELEGAL_AI_MODE=mock; otherwise use the real API
 * whenever a key is present. Mock mode keeps the whole app testable without
 * credentials.
 */
export const AI_MODE =
  process.env.PRELEGAL_AI_MODE === 'mock' || !OPENROUTER_API_KEY ? 'mock' : 'openrouter';

fs.mkdirSync(DATA_DIR, { recursive: true });
