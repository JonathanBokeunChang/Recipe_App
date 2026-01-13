import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCommand } from './exec.js';
import { transcribeAudio } from './asr.js';
import { generateRecipeFromVideo } from './llm.js';
import { normalizeTikTokUrl } from './tiktok.js';

/**
 * Orchestrates a pipeline that downloads a TikTok video, extracts audio and frames, runs OCR and transcription, and generates a recipe from the video.
 *
 * @param {Object} params - Function parameters.
 * @param {string} params.sourceUrl - The TikTok video URL (raw user-provided URL) to process.
 * @returns {{ recipe: any, steps: Array<{name:string,status:string,durationMs:number,error?:string}>, workdir: string, durationMs: number }} An object containing the generated `recipe`, an array of `steps` with metadata (name, status, durationMs, and optional error), the temporary `workdir` path, and total `durationMs` for the pipeline run.
 * @throws {Error} If URL normalization fails, if required CLI tools (yt-dlp, ffmpeg) are not installed, or if a step fails irrecoverably.
 */
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

  const audioPath = await runStep('extract_audio', async () => {
    const dest = path.join(workdir, 'audio.wav');
    try {
      await runCommand('ffmpeg', ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', dest]);
    } catch (err) {
      if (err?.code === 'ENOENT') {
        throw new Error('ffmpeg not installed. Install ffmpeg to extract audio for transcription.');
      }
      throw err;
    }
    return dest;
  });

  const transcript = await runStep('transcribe_audio', async () => {
    return transcribeAudio({ audioPath, workdir, sourceUrl: resolvedUrl });
  });

  const framePaths = await runStep('sample_frames', async () => {
    const pattern = path.join(workdir, 'frame-%02d.jpg');
    const frameCfg = getFrameConfig();
    try {
      const args = ['-y', '-i', videoPath, '-vf', `fps=${frameCfg.fps}`];
      if (frameCfg.maxFrames > 0) {
        args.push('-frames:v', String(frameCfg.maxFrames));
      }
      args.push(pattern);
      await runCommand('ffmpeg', args);
    } catch (err) {
      if (err?.code === 'ENOENT') {
        throw new Error('ffmpeg not installed. Install ffmpeg to capture frames for OCR/vision.');
      }
      throw err;
    }
    const files = await fs.readdir(workdir);
    return files.filter((f) => f.startsWith('frame-') && f.endsWith('.jpg')).map((f) => path.join(workdir, f));
  });

  const ocrText = await runStep('ocr_frames', async () => {
    if (!framePaths.length) return '';
    try {
      const texts = [];
      for (const frame of framePaths) {
        const outBase = frame.replace(/\.jpg$/, '');
        await runCommand('tesseract', [frame, outBase, '--psm', '6']);
        const txt = await fs.readFile(`${outBase}.txt`, 'utf-8');
        texts.push(txt.trim());
      }
      return texts.filter(Boolean).join('\n');
    } catch {
      // Keep pipeline going if OCR is unavailable; AI still has transcript + frames.
      return '';
    }
  });

  const recipe = await runStep('llm_recipe', async () => {
    return generateRecipeFromVideo({
      url: resolvedUrl,
      transcript,
      ocrText,
      frames: framePaths,
    });
  });

  return {
    recipe,
    steps,
    workdir,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Provide configuration for frame sampling when extracting frames from a video.
 *
 * @returns {{fps: number, maxFrames: number}} Configuration object:
 *  - `fps`: frames per second to sample (from `FRAME_SAMPLE_FPS`, default 2 — one frame every 0.5 seconds).
 *  - `maxFrames`: maximum number of frames to extract (from `MAX_FRAME_SAMPLES`, default 24).
 */
function getFrameConfig() {
  return {
    fps: Number(process.env.FRAME_SAMPLE_FPS ?? 2), // default: 1 frame every 0.5s
    maxFrames: Number(process.env.MAX_FRAME_SAMPLES ?? 24), // cap to avoid huge extractions
  };
}