import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCommand } from './exec.js';
import { generateRecipeFromVideo } from './llm.js';
import { normalizeTikTokUrl } from './tiktok.js';

export async function runTikTokPipeline({ sourceUrl }) {
  const steps = [];
  const startedAt = Date.now();
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-recipe-'));

  const runStep = async (name, fn) => {
    const stepStart = Date.now();
    console.info(`[step:start] ${name}`);
    try {
      const result = await fn();
      console.info(`[step:ok] ${name} ${Date.now() - stepStart}ms`);
      steps.push({
        name,
        status: 'completed',
        durationMs: Date.now() - stepStart,
      });
      return result;
    } catch (err) {
      console.error(
        `[step:fail] ${name} ${Date.now() - stepStart}ms`,
        err?.message ?? err
      );
      steps.push({
        name,
        status: 'failed',
        durationMs: Date.now() - stepStart,
        error: err?.message ?? String(err),
      });
      throw err;
    }
  };

  const normalizedUrl = await runStep('normalize_url', () => {
    const res = normalizeTikTokUrl(sourceUrl);
    if (!res.ok) throw new Error(res.error);
    return res.url;
  });

  const resolvedUrl = await runStep('resolve_download_url', async () => {
    // yt-dlp handles vm./vt. redirects; ensure it is installed and on PATH.
    return normalizedUrl;
  });

  const videoPath = await runStep('download_video', async () => {
    const dest = path.join(workdir, 'video.mp4');
    try {
      await runCommand('yt-dlp', ['-o', dest, resolvedUrl]);
    } catch (err) {
      if (err?.code === 'ENOENT') {
        throw new Error('yt-dlp not installed. Install via `pip install yt-dlp` to fetch videos.');
      }
      throw err;
    }
    return dest;
  });

  const recipe = await runStep('gemini_video_recipe', async () => {
    return generateRecipeFromVideo({ videoPath, url: resolvedUrl });
  });

  return {
    recipe,
    steps,
    workdir,
    durationMs: Date.now() - startedAt,
  };
}
