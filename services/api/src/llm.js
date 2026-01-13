import fs from 'node:fs/promises';
import OpenAI from 'openai';
import './env.js';

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

function createClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Set it to enable recipe generation.');
  }
  return new OpenAI({ apiKey });
}

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

function truncate(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

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
