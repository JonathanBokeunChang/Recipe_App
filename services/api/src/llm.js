import fs from 'node:fs/promises';
import OpenAI from 'openai';
import './env.js';

/**
 * Generate a normalized recipe object inferred from a video URL and its associated signals.
 *
 * Builds a prompt from the provided video URL, transcript, OCR text, and selected frame images, calls the configured LLM to extract recipe data, parses and normalizes the LLM output, and returns a consistent recipe structure. If the LLM call or parsing fails, returns a heuristic offline fallback recipe constructed from the available signals.
 *
 * @param {Object} params - Input parameters.
 * @param {string} params.url - Source video URL used as the primary context for recipe inference.
 * @param {string} [params.transcript] - Full or partial transcript of the video's audio; may be truncated before sending to the model.
 * @param {string} [params.ocrText] - Extracted OCR text from the video frames; may be truncated before sending to the model.
 * @param {string[]} [params.frames] - File paths to selected frame images; readable frames will be base64-encoded and included for the model.
 * @returns {Object} A normalized recipe object containing at least: `title`, `servings`, `ingredients`, `steps`, `times`, `macros`, `assumptions`, `confidence`, and `transcriptSnippet`.
export async function generateRecipeFromVideo({ url, transcript, ocrText = '', frames = [] }) {
  const config = getLlmConfig();
  const content = await buildContent({ url, transcript, ocrText, frames });

  try {
    console.info(
      '[llm] model',
      config.model,
      'frames',
      frames?.length ?? 0,
      'transcript',
      Boolean(transcript),
      'ocr',
      Boolean(ocrText)
    );
    const client = createClient();
    const response = await client.chat.completions.create({
      model: config.model,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    });

    const message = response.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error('Recipe model returned no content.');
    }

    const parsed = JSON.parse(message);
    return normalizeRecipe(parsed, { transcript, ocrText, frames });
  } catch (err) {
    console.warn('LLM fallback: using heuristic recipe because OpenAI call failed:', err?.message ?? err);
    return buildFallbackRecipe({ url, transcript, ocrText, frames });
  }
}

/**
 * Create an OpenAI client using the OPENAI_API_KEY environment variable.
 *
 * @returns {OpenAI} An OpenAI client instance configured with the environment API key.
 * @throws {Error} If `OPENAI_API_KEY` is not set in the environment.
 */
function createClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Set it to enable recipe generation.');
  }
  return new OpenAI({ apiKey });
}

/**
 * Assemble a sequence of content parts (text and image blocks) to send to the LLM for recipe inference.
 *
 * The returned parts always include the source video URL and an instruction block; if provided, a truncated
 * transcript and truncated OCR/on-screen text are appended. Any readable frame paths are converted into
 * encoded image blocks and appended as ordered frame headers followed by image_url parts.
 *
 * @param {Object} params - Input values used to build the content payload.
 * @param {string} params.url - Source video URL to include as context.
 * @param {string} [params.transcript] - Full transcript text; will be truncated to the configured max transcript length when included.
 * @param {string} [params.ocrText] - OCR / on-screen text; will be truncated to the configured max OCR length when included.
 * @param {string[]} [params.frames] - File paths to frame images; readable frames are encoded and added as image parts.
 * @returns {Array<Object>} An array of content parts where each part is either a text block (type: 'text') or an image block (type: 'image_url' with an `image_url` object containing `url` and `detail`).
 */
async function buildContent({ url, transcript, ocrText, frames }) {
  const { maxTranscriptChars, maxOcrChars } = getLlmConfig();
  const parts = [
    {
      type: 'text',
      text: `Source video URL: ${url}`,
    },
    {
      type: 'text',
      text:
        'Use the transcript, on-screen text, and frames to infer ingredients, amounts, cooking method, and timing. ' +
        'Respect dietary safety: avoid allergens that are explicitly excluded in the video text or transcript.',
    },
  ];

  if (transcript) {
    parts.push({
      type: 'text',
      text: `Transcript (may be truncated):\n${truncate(transcript, maxTranscriptChars)}`,
    });
  }

  if (ocrText) {
    parts.push({
      type: 'text',
      text: `On-screen text/OCR (may be truncated):\n${truncate(ocrText, maxOcrChars)}`,
    });
  }

  const encodedFrames = await encodeFrames(frames);
  encodedFrames.forEach((frameUrl, idx) => {
    parts.push({ type: 'text', text: `Frame ${idx + 1}` });
    parts.push({
      type: 'image_url',
      image_url: { url: frameUrl, detail: 'auto' },
    });
  });

  return parts;
}

/**
 * Convert a list of image file paths into base64-encoded JPEG data URLs, limited by the configured maximum.
 *
 * Reads the provided frame file paths, encodes readable images as `data:image/jpeg;base64,...`, and skips any files that cannot be read. The number of returned frames is constrained by the LLM configuration's maxFrameImages setting and preserves the selection order.
 * @param {string[]} framePaths - Local file paths to frame images.
 * @returns {Promise<string[]>} An array of JPEG data URL strings for the successfully read and selected frames.
async function encodeFrames(framePaths) {
  if (!framePaths?.length) return [];
  const { maxFrameImages } = getLlmConfig();
  const ordered = [...framePaths].sort();
  const limited = selectFrames(ordered, maxFrameImages);
  const encoded = [];
  for (const frame of limited) {
    try {
      const buf = await fs.readFile(frame);
      encoded.push(`data:image/jpeg;base64,${buf.toString('base64')}`);
    } catch {
      // Skip unreadable frames.
    }
  }
  return encoded;
}

/**
 * Selects up to `maxCount` file paths evenly sampled from the provided list.
 *
 * @param {string[]} paths - Ordered list of file paths to sample from.
 * @param {number} maxCount - Maximum number of paths to return; if falsy or greater than or equal to `paths.length`, the original `paths` array is returned.
 * @returns {string[]} An array of sampled paths (at most `maxCount`), evenly spaced from the input. Duplicate entries are removed while preserving the first occurrence order.
 */
function selectFrames(paths, maxCount) {
  if (!maxCount || paths.length <= maxCount) return paths;
  const selected = [];
  const step = (paths.length - 1) / (maxCount - 1);
  for (let i = 0; i < maxCount; i += 1) {
    const idx = Math.round(i * step);
    selected.push(paths[idx]);
  }
  return Array.from(new Set(selected));
}

/**
 * Normalize a parsed recipe into the module's canonical recipe shape and attach input usage metadata.
 *
 * @param {Object} recipe - Recipe object (typically parsed from the LLM) whose properties may be missing or partial.
 * @param {Object} options - Context about the inputs used to generate the recipe.
 * @param {string} [options.transcript] - Source transcript text; used to populate `transcriptSnippet` and `confidence.transcriptUsed`.
 * @param {string} [options.ocrText] - OCR-extracted text; used to set `confidence.ocrUsed`.
 * @param {string[]} [options.frames] - Array of frame paths or data; length is used to set `confidence.framesUsed`.
 * @returns {Object} A normalized recipe object containing:
 *   - title: recipe title or `'Generated Recipe'`.
 *   - servings: number of servings or `2`.
 *   - ingredients: array of ingredient entries (defaults to []).
 *   - steps: array of step strings (defaults to []).
 *   - times: timing information object (defaults to {}).
 *   - macros: nutritional macros object (defaults to {}).
 *   - assumptions: array of assumption strings (defaults to []).
 *   - confidence: object with `transcriptUsed` (`true` if transcript provided), `ocrUsed` (`true` if ocrText provided), `framesUsed` (number of frames provided), and `source` (from recipe.confidence.source or `'openai-gpt'`).
 *   - transcriptSnippet: truncated transcript (up to 160 chars) when a transcript is provided, otherwise `undefined`.
 */
function normalizeRecipe(recipe, { transcript, ocrText, frames }) {
  return {
    title: recipe.title || 'Generated Recipe',
    servings: recipe.servings || 2,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    times: recipe.times || {},
    macros: recipe.macros || {},
    assumptions: recipe.assumptions || [],
    confidence: {
      transcriptUsed: Boolean(transcript),
      ocrUsed: Boolean(ocrText),
      framesUsed: frames?.length ?? 0,
      source: recipe?.confidence?.source || 'openai-gpt',
    },
    transcriptSnippet: transcript ? truncate(transcript, 160) : undefined,
  };
}

/**
 * Produce a heuristic recipe object to use when LLM-based generation fails.
 *
 * The returned object is a best-effort, offline fallback containing a draft
 * title, servings, a short ingredient list, simple preparation steps, estimated
 * times, macronutrient estimates, contextual assumptions (including truncated
 * hints derived from OCR/transcript if available), a confidence summary, and
 * an optional transcript snippet.
 *
 * @param {Object} params - Input signals used to build contextual hints.
 * @param {string} [params.url] - Source video URL (not required but may provide context).
 * @param {string} [params.transcript] - Full or partial transcript text; a truncated snippet may be included in the result.
 * @param {string} [params.ocrText] - OCR-extracted text from frames; used to generate context hints.
 * @param {string[]} [params.frames] - Array of frame file paths; only presence/length is recorded in the confidence object.
 * @returns {Object} A normalized recipe-like object with the following keys:
 *   - title {string}
 *   - servings {number}
 *   - ingredients {Array<{name: string, quantity: string}>}
 *   - steps {string[]}
 *   - times {{prepMinutes: number, cookMinutes: number}}
 *   - macros {{calories: number, protein: number, carbs: number, fat: number}}
 *   - assumptions {string[]} (includes context hints and a note that this is a fallback)
 *   - confidence {{transcriptUsed: boolean, ocrUsed: boolean, framesUsed: number, source: string}}
 *   - transcriptSnippet {string|undefined} (truncated transcript when available)
 */
function buildFallbackRecipe({ url, transcript, ocrText, frames }) {
  const hints = [];
  if (ocrText) hints.push(truncate(ocrText, 200));
  if (transcript) hints.push(truncate(transcript, 200));
  if (!hints.length) hints.push('No transcript or OCR available; inferred a generic quick meal.');

  const baseMacros = { calories: 480, protein: 30, carbs: 40, fat: 18 };
  return {
    title: 'Recipe draft (offline fallback)',
    servings: 2,
    ingredients: [
      { name: 'Chicken or protein of choice', quantity: '400 g' },
      { name: 'Vegetables (mixed)', quantity: '2 cups, chopped' },
      { name: 'Oil or butter', quantity: '1.5 tbsp' },
      { name: 'Salt & pepper', quantity: 'to taste' },
    ],
    steps: [
      'Season protein and sear until browned and cooked through.',
      'Saute vegetables in the same pan with a little oil.',
      'Combine, adjust seasoning, and serve with grains or greens.',
    ],
    times: { prepMinutes: 10, cookMinutes: 15 },
    macros: baseMacros,
    assumptions: [
      'Fallback recipe used because OpenAI was unavailable (quota/network).',
      'Adjust ingredients to match the video once online.',
      ...hints.map((h) => `Context hint: ${h}`),
    ],
    confidence: {
      transcriptUsed: Boolean(transcript),
      ocrUsed: Boolean(ocrText),
      framesUsed: frames?.length ?? 0,
      source: 'fallback-heuristic',
    },
    transcriptSnippet: transcript ? truncate(transcript, 160) : undefined,
  };
}

/**
 * Truncate text to a maximum number of characters, appending an ellipsis when truncation occurs.
 * @param {string} text - The input text to truncate; falsy values produce an empty string.
 * @param {number} max - Maximum number of characters to keep from the start of `text`; if truncation occurs an ellipsis (`…`) is appended after these characters.
 * @returns {string} The original text if its length is less than or equal to `max`, otherwise the first `max` characters followed by an ellipsis, or an empty string for falsy input.
 */
function truncate(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/**
 * Retrieve LLM-related configuration values from environment variables, falling back to sensible defaults.
 *
 * @returns {{model: string, maxTranscriptChars: number, maxOcrChars: number, maxFrameImages: number}}
 * An object containing:
 * - model: the OpenAI model identifier to use.
 * - maxTranscriptChars: maximum number of transcript characters to include.
 * - maxOcrChars: maximum number of OCR characters to include.
 * - maxFrameImages: maximum number of frame images to include.
 */
function getLlmConfig() {
  return {
    model: process.env.OPENAI_RECIPE_MODEL || 'gpt-4o-mini',
    maxTranscriptChars: Number(process.env.MAX_TRANSCRIPT_CHARS ?? 12000),
    maxOcrChars: Number(process.env.MAX_OCR_CHARS ?? 4000),
    maxFrameImages: Number(process.env.MAX_FRAME_IMAGES ?? 8),
  };
}

const SYSTEM_PROMPT = `
You are a culinary AI that turns cooking videos into detailed, editable recipes with macros.
Use every signal (audio transcript, on-screen text, and provided frames) to infer ingredients, amounts, methods, timing, and macro estimates.
Prioritize accuracy: transcript > on-screen OCR > frames. Use transcript for sequence/timing; use OCR for exact labels/quantities; use frames to resolve visual cues (doneness, ingredient identity, cooking method). When signals conflict, explain assumptions briefly in the "assumptions" array.
Respond ONLY with a JSON object matching this shape:
{
  "title": string,
  "servings": number,
  "ingredients": [{ "name": string, "quantity": string }],
  "steps": [string],
  "times": { "prepMinutes": number, "cookMinutes": number },
  "macros": { "calories": number, "protein": number, "carbs": number, "fat": number },
  "assumptions": [string],
  "confidence": { "source": "openai", "transcriptUsed": boolean, "ocrUsed": boolean, "framesUsed": number }
}
Rules:
- If quantities are missing, infer realistic amounts; note assumptions.
- Include numbered, clear cooking steps (1 step per array item).
- Macros should be per serving; state assumptions when estimating oils/sauces.
- Avoid allergens explicitly excluded in the provided text; otherwise follow the video faithfully.
`;