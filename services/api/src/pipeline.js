import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCommand } from './exec.js';
import { generateRecipeFromVideo, generateRecipeFromTranscript, generateRecipeFromCaption, generateRecipeFromImage } from './llm.js';
import { normalizeTikTokUrl } from './tiktok.js';
import { getTikTokOEmbed } from './tiktok-oembed.js';
import { extractTikTokTranscript } from './transcript-api.js';

/**
 * Extract a short, descriptive title from a TikTok caption
 * TikTok captions often contain the entire recipe in text form - we want just the dish name
 * @param {string} caption - The full TikTok caption/title
 * @param {string} authorName - The author's name (fallback)
 * @returns {string} A short recipe title
 */
function extractShortTitle(caption, authorName) {
  if (!caption || caption.trim() === '') {
    return authorName ? `Recipe by ${authorName}` : 'Recipe from TikTok';
  }

  // Clean up the caption
  let title = caption.trim();

  // Remove common TikTok prefixes
  title = title.replace(/^(recipe|how to make|easy|simple|quick|the best|my|homemade)\s+/i, '');

  // Take just the first line if there are line breaks
  const firstLine = title.split(/[\n\r]/)[0].trim();

  // Remove hashtags and everything after them
  const withoutHashtags = firstLine.split(/#/)[0].trim();

  // Remove emojis (common in TikTok captions)
  const withoutEmojis = withoutHashtags.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '').trim();

  // If still too long, truncate intelligently
  let result = withoutEmojis;
  if (result.length > 60) {
    // Try to find a natural break point (comma, dash, pipe)
    const breakMatch = result.match(/^(.{20,50}?)[,\-|•]/);
    if (breakMatch) {
      result = breakMatch[1].trim();
    } else {
      // Just take first ~50 chars and find word boundary
      result = result.substring(0, 50).replace(/\s+\S*$/, '').trim();
      if (result.length < 10) {
        // If too short after truncation, use more
        result = withoutEmojis.substring(0, 50).trim() + '...';
      }
    }
  }

  // Final cleanup - remove trailing punctuation except for reasonable chars
  result = result.replace(/[,\-|•:]+$/, '').trim();

  // If we ended up with nothing useful, use fallback
  if (!result || result.length < 3) {
    return authorName ? `Recipe by ${authorName}` : 'Recipe from TikTok';
  }

  return result;
}

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

    // Step 4: Generate recipe from transcript OR caption
    const recipe = await runStep('generate_recipe', async () => {
      if (!transcript.text || transcript.confidence < 0.3) {
        // Low confidence or no transcript - try to extract from caption instead
        console.warn('[pipeline] low transcript confidence or no transcript available');
        console.info('[pipeline] attempting to extract recipe from TikTok caption');

        // Try to extract recipe from the TikTok caption/bio
        // Many cooking videos include the full recipe in their description
        const captionRecipe = await generateRecipeFromCaption({
          metadata,
          url: normalizedUrl
        });

        // Add a note about the extraction method
        if (captionRecipe.confidence?.source === 'gemini-caption') {
          captionRecipe.assumptions = captionRecipe.assumptions || [];
          captionRecipe.assumptions.push(
            'Recipe extracted from video caption/bio (no audio transcript available).',
            'For more accurate extraction, upload the video directly.'
          );
        }

        return captionRecipe;
      }

      return await generateRecipeFromTranscript({
        transcript,
        metadata,
        url: normalizedUrl
      });
    });

    // Determine the extraction method used
    const extractionMethod = transcript.text && transcript.confidence >= 0.3
      ? 'transcript'
      : (recipe.confidence?.source === 'gemini-caption' ? 'caption' : 'fallback');

    return {
      recipe,
      steps,
      metadata: {
        transcriptAvailable: !!transcript.text,
        transcriptConfidence: transcript.confidence,
        method: extractionMethod,
        captionBased: recipe.confidence?.captionBased || false,
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

/**
 * Pipeline for user-uploaded recipe images (handwritten or typed)
 * @param {Object} params - Parameters object
 * @param {string} params.imagePath - Path to the uploaded image
 * @param {string} [params.originalName] - Original filename for metadata
 * @param {string} [params.mimeType] - MIME type of the image
 * @returns {Promise<Object>} Pipeline result with recipe, steps, and metadata
 */
export async function runRecipeImagePipeline({ imagePath, originalName, mimeType }) {
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

  const recipe = await runStep('gemini_image_recipe', async () => {
    return await generateRecipeFromImage({
      imagePath,
      mimeType,
      url: null,
      originalName,
    });
  });

  return {
    recipe,
    steps,
    metadata: {
      method: 'recipe_image',
      originalName,
      mimeType,
    },
    durationMs: Date.now() - startedAt,
  };
}
