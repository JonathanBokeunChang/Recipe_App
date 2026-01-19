import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCommand } from './exec.js';
import { generateRecipeFromVideo, generateRecipeFromTranscript } from './llm.js';
import { normalizeTikTokUrl } from './tiktok.js';
import { getTikTokOEmbed } from './tiktok-oembed.js';
import { extractTikTokTranscript } from './transcript-api.js';

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

/**
 * NEW: ToS-compliant TikTok pipeline using transcript extraction
 * Replaces old yt-dlp download approach for TikTok URLs
 * @param {Object} params - Parameters object
 * @param {string} params.sourceUrl - The TikTok video URL
 * @returns {Promise<Object>} Pipeline result with recipe, steps, and metadata
 */
export async function runTikTokPipelineCompliant({ sourceUrl }) {
  const steps = [];
  const startedAt = Date.now();

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

  try {
    // Step 1: Normalize URL (keep existing logic)
    const normalizedUrl = await runStep('normalize_url', () => {
      const result = normalizeTikTokUrl(sourceUrl);
      if (!result.ok) throw new Error(result.error);
      return result.url;
    });

    // Step 2: Get video metadata via oEmbed (official API)
    const metadata = await runStep('fetch_metadata', async () => {
      return await getTikTokOEmbed(normalizedUrl);
    });

    // Step 3: Extract transcript via third-party API
    const transcript = await runStep('extract_transcript', async () => {
      try {
        return await extractTikTokTranscript(normalizedUrl);
      } catch (err) {
        console.warn('[pipeline] transcript extraction failed:', err.message);
        // Return partial result to trigger fallback
        return {
          text: '',
          confidence: 0,
          error: err.message
        };
      }
    });

    // Step 4: Generate recipe from transcript
    const recipe = await runStep('generate_recipe', async () => {
      if (!transcript.text || transcript.confidence < 0.3) {
        // Low confidence or no transcript - return fallback with suggestion
        console.warn('[pipeline] low transcript confidence or no transcript available');
        return {
          title: metadata.title || 'Recipe from TikTok',
          servings: 2,
          ingredients: [],
          steps: ['Unable to extract recipe from video transcript. Please upload the video directly for better results.'],
          times: {},
          macros: {},
          assumptions: [
            'Transcript extraction failed or video has no captions.',
            'For best results, download the video and upload it directly to the app.',
          ],
          confidence: {
            source: 'fallback',
            transcriptBased: true,
            transcriptConfidence: transcript.confidence,
            reason: 'no_transcript_available',
            suggestion: 'upload_video_for_better_results'
          },
          sourceUrl: normalizedUrl
        };
      }

      return await generateRecipeFromTranscript({
        transcript,
        metadata,
        url: normalizedUrl
      });
    });

    return {
      recipe,
      steps,
      metadata: {
        transcriptAvailable: !!transcript.text,
        transcriptConfidence: transcript.confidence,
        method: transcript.text ? 'transcript' : 'fallback',
        videoMetadata: metadata
      },
      durationMs: Date.now() - startedAt,
    };

  } catch (err) {
    console.error('[pipeline] TikTok compliant pipeline failed:', err);
    throw err;
  }
}

/**
 * NEW: Pipeline for user-uploaded videos
 * Used when user uploads video from camera roll
 * This flow is ToS-compliant (user owns/uploaded the content)
 * @param {Object} params - Parameters object
 * @param {string} params.videoPath - Path to the uploaded video file
 * @returns {Promise<Object>} Pipeline result with recipe, steps, and metadata
 */
export async function runLocalVideoPipeline({ videoPath }) {
  const steps = [];
  const startedAt = Date.now();

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

  const recipe = await runStep('gemini_video_recipe', async () => {
    return await generateRecipeFromVideo({
      videoPath,
      url: null
    });
  });

  return {
    recipe,
    steps,
    metadata: {
      method: 'video_upload'
    },
    durationMs: Date.now() - startedAt,
  };
}
