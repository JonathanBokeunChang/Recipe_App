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

export function logEnvStatus() {
  const geminiStatus = process.env.GEMINI_API_KEY ? 'set' : 'missing';
  const fdcStatus = process.env.FDC_API_KEY ? 'set' : 'missing (macro estimation will be limited)';
  const transcriptStatus = process.env.TRANSCRIPT_API_KEY ? 'set' : 'missing';
  const transcriptProvider = process.env.TRANSCRIPT_API_PROVIDER || 'supadata';
  const useCompliant = process.env.USE_COMPLIANT_PIPELINE !== 'false' ? 'enabled (transcript-based)' : 'disabled (using yt-dlp)';
  const loadedMsg = loaded.length ? loaded.join(', ') : 'none';

  console.info(
    `[env] GEMINI_API_KEY: ${geminiStatus} | FDC_API_KEY: ${fdcStatus} | TRANSCRIPT_API_KEY: ${transcriptStatus} | loaded: ${loadedMsg} | cwd: ${cwd}`
  );
  console.info(
    `[env] Transcript provider: ${transcriptProvider} | Compliant pipeline: ${useCompliant}`
  );

  // Required keys
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[env] WARNING: GEMINI_API_KEY is required for video processing. Set it in services/api/.env');
  }
  if (!process.env.TRANSCRIPT_API_KEY) {
    console.warn('[env] WARNING: TRANSCRIPT_API_KEY is missing. TikTok URL processing will fail. Get a key from https://supadata.ai');
  }
}
