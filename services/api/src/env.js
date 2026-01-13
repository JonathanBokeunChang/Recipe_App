import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const cwd = process.cwd();
const candidates = [
  path.join(cwd, '.env'),
  path.join(cwd, '..', '.env'),
  path.join(cwd, '..', '..', '.env'),
  path.join(cwd, 'services', '.env'),
  path.join(cwd, 'services', 'api', '.env'),
];

const tried = [];
const loaded = [];
const seen = new Set();

for (const candidate of candidates) {
  const resolved = path.resolve(candidate);
  if (seen.has(resolved)) continue;
  seen.add(resolved);
  tried.push(resolved);
  if (!fs.existsSync(resolved)) continue;
  const result = dotenv.config({ path: resolved, override: false });
  if (!result.error) loaded.push(resolved);
}

export const envInfo = { tried, loaded };

/**
 * Log whether OPENAI_API_KEY is present, which .env files were loaded, and the current working directory.
 *
 * Writes a single info-level line containing: OPENAI_API_KEY status (`set` or `missing`), the comma-separated list of loaded .env paths (or `none`), and the current working directory.
 */
export function logEnvStatus() {
  const keyStatus = process.env.OPENAI_API_KEY ? 'set' : 'missing';
  const loadedMsg = loaded.length ? loaded.join(', ') : 'none';
  console.info(
    `[env] OPENAI_API_KEY: ${keyStatus} | loaded: ${loadedMsg} | cwd: ${cwd}`
  );
}