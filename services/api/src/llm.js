import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import './env.js';
import { buildModificationPrompt } from './goals.js';
import { buildSubstitutionPlan } from './substitutions/engine.js';
import { estimateMacros } from './macros.js';
import { hasFdcKey } from './fdc.js';

function normalizeUserContext(userContext = {}) {
  const ctx = { ...(userContext || {}) };
  const conditions = Array.isArray(ctx.conditions)
    ? ctx.conditions.filter((c) => typeof c === 'string')
    : [];
  ctx.conditions = conditions;

  const allergenSet = new Set(
    Array.isArray(ctx.allergens)
      ? ctx.allergens.map((a) => String(a).toLowerCase())
      : []
  );

  if (conditions.includes('celiac')) {
    allergenSet.add('gluten');
  }

  ctx.allergens = Array.from(allergenSet);
  return ctx;
}

export async function generateRecipeFromVideo({ videoPath, url }) {
  const config = getLlmConfig();

  try {
    console.info('[llm] uploading video to Gemini for analysis');

    const genAI = createClient();
    const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

    // Upload video file to Gemini
    const uploadResult = await fileManager.uploadFile(videoPath, {
      mimeType: 'video/mp4',
      displayName: 'cooking-video'
    });

    console.info('[llm] video uploaded, waiting for processing');

    // Wait for video to be processed
    let file = await fileManager.getFile(uploadResult.file.name);
    while (file.state === 'PROCESSING') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      file = await fileManager.getFile(uploadResult.file.name);
    }

    if (file.state === 'FAILED') {
      throw new Error('Video processing failed on Gemini servers');
    }

    console.info('[llm] video processed, generating recipe with model', config.model);

    // Generate recipe from video
    const model = genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json'
      }
    });

    const result = await model.generateContent([
      {
        fileData: {
          fileUri: file.uri,
          mimeType: file.mimeType
        }
      },
      { text: SYSTEM_PROMPT }
    ]);

    const response = result.response;
    const message = response.text();

    if (!message) {
      throw new Error('Recipe model returned no content.');
    }

    // Clean up uploaded file
    try {
      await fileManager.deleteFile(uploadResult.file.name);
      console.info('[llm] cleaned up uploaded video file');
    } catch (cleanupErr) {
      console.warn('[llm] failed to cleanup uploaded file:', cleanupErr?.message);
    }

    const parsed = JSON.parse(message);
    return normalizeRecipe(parsed, { url, videoAnalysis: true });

  } catch (err) {
    console.warn('LLM fallback: using heuristic recipe because Gemini call failed:', err?.message ?? err);
    return buildFallbackRecipe({ url });
  }
}

/**
 * Generate recipe from video transcript (text-based extraction)
 * Complements existing generateRecipeFromVideo() for user uploads
 * This is ToS-compliant as it doesn't download TikTok videos
 * @param {Object} params - Parameters object
 * @param {Object} params.transcript - Transcript object with text, segments, language, confidence
 * @param {Object} params.metadata - Video metadata from oEmbed API
 * @param {string} params.url - Source video URL
 * @returns {Promise<Object>} Normalized recipe object
 */
export async function generateRecipeFromTranscript({ transcript, metadata, url }) {
  const config = getLlmConfig();

  try {
    console.info('[llm] generating recipe from transcript');
    console.info('[llm] transcript length:', transcript.text?.length || 0, 'characters');
    console.info('[llm] transcript confidence:', transcript.confidence);

    const genAI = createClient();
    const model = genAI.getGenerativeModel({
      model: config.model, // 'gemini-1.5-flash'
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json'
      }
    });

    // Extract a short title from the potentially long TikTok caption
    const tiktokCaption = metadata.title || 'Unknown';

    const prompt = `${SYSTEM_PROMPT}

Video Metadata:
- TikTok Caption (may be long - extract recipe name from this): ${tiktokCaption}
- Author: ${metadata.authorName || 'Unknown'}
- Source: TikTok cooking video

Video Transcript:
${transcript.text}

Extract the recipe from this cooking video transcript. Include all ingredients with quantities, numbered steps in order, estimated times, and macros. Mark any inferred data in assumptions.

IMPORTANT - Title extraction rules:
- The TikTok caption above may contain the ENTIRE recipe in text form - do NOT use this as the title
- Generate a SHORT, DESCRIPTIVE recipe title (3-8 words max) that describes the dish
- Examples of good titles: "Garlic Butter Chicken", "One-Pan Pasta Primavera", "Easy Beef Tacos"
- Do NOT include hashtags, emojis, or promotional text in the title

Important: Since this is extracted from a transcript (not full video analysis), you may need to infer some details:
- Visual-only ingredients may be missing; note these as assumptions
- Quantities might be approximate if not clearly stated
- Cooking techniques may need to be inferred from audio descriptions
- Be conservative with macro estimates and clearly state assumptions`;

    const result = await model.generateContent([{ text: prompt }]);
    const response = result.response;
    const message = response.text();

    if (!message) {
      throw new Error('Recipe model returned no content.');
    }

    const parsed = JSON.parse(message);
    return normalizeRecipe(parsed, {
      url,
      videoAnalysis: false,
      transcriptBased: true,
      transcriptConfidence: transcript.confidence
    });

  } catch (err) {
    console.warn('[llm] transcript recipe extraction failed:', err?.message ?? err);
    return buildFallbackRecipe({ url, reason: 'transcript_processing_failed' });
  }
}

function createClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing. Set it to enable recipe generation.');
  }
  return new GoogleGenerativeAI(apiKey);
}

function normalizeRecipe(recipe, { url, videoAnalysis, transcriptBased, transcriptConfidence, captionBased }) {
  let source = 'gemini-video';
  if (transcriptBased) source = 'gemini-transcript';
  if (captionBased) source = 'gemini-caption';

  return {
    title: recipe.title || 'Generated Recipe',
    servings: recipe.servings || 2,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    times: recipe.times || {},
    macros: recipe.macros || {},
    assumptions: recipe.assumptions || [],
    confidence: {
      source,
      videoAnalysis: videoAnalysis,
      transcriptBased: transcriptBased || false,
      captionBased: captionBased || false,
      transcriptConfidence: transcriptConfidence || undefined,
      ...(recipe.confidence || {})
    },
    sourceUrl: url
  };
}

/**
 * Generate recipe from TikTok caption/bio when transcript is unavailable
 * Many TikTok cooking videos include the full recipe in their caption
 * @param {Object} params - Parameters object
 * @param {Object} params.metadata - Video metadata from oEmbed API (includes caption as title)
 * @param {string} params.url - Source video URL
 * @returns {Promise<Object>} Normalized recipe object
 */
export async function generateRecipeFromCaption({ metadata, url }) {
  const config = getLlmConfig();
  const caption = metadata.title || '';

  // Check if caption looks like it contains recipe content
  const hasRecipeContent = caption.length > 100 ||
    /ingredient|step|cook|bake|mix|add|tbsp|tsp|cup|oz|gram|minute/i.test(caption);

  if (!hasRecipeContent) {
    console.info('[llm] caption too short or lacks recipe keywords, using fallback');
    return buildFallbackRecipe({ url, reason: 'no_recipe_in_caption' });
  }

  try {
    console.info('[llm] generating recipe from TikTok caption');
    console.info('[llm] caption length:', caption.length, 'characters');

    const genAI = createClient();
    const model = genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json'
      }
    });

    const prompt = `${SYSTEM_PROMPT}

You are extracting a recipe from a TikTok video caption/bio. The creator has written out recipe details in their video description.

Video Information:
- Author: ${metadata.authorName || 'Unknown'}
- Source: TikTok cooking video

TikTok Caption/Bio (contains the recipe):
${caption}

Extract the recipe from this TikTok caption. The creator likely included ingredients and instructions in the text above.

IMPORTANT - Title extraction rules:
- Generate a SHORT, DESCRIPTIVE recipe title (3-8 words max) that describes the dish
- Examples: "Honey BBQ Chicken Mac & Cheese", "Garlic Butter Shrimp Pasta"
- Do NOT include hashtags, emojis, meal prep counts, or promotional text in the title

IMPORTANT - Extraction rules:
- Parse ingredient lists from the caption (look for quantities like "2 cups", "1 lb", "500g")
- Convert informal measurements to standard ones when needed
- Extract cooking steps in order (look for numbered lists or sequential instructions)
- Estimate macros based on the ingredients
- Note any assumptions you make in the assumptions array`;

    const result = await model.generateContent([{ text: prompt }]);
    const response = result.response;
    const message = response.text();

    if (!message) {
      throw new Error('Recipe model returned no content.');
    }

    const parsed = JSON.parse(message);
    return normalizeRecipe(parsed, {
      url,
      videoAnalysis: false,
      transcriptBased: false,
      captionBased: true
    });

  } catch (err) {
    console.warn('[llm] caption recipe extraction failed:', err?.message ?? err);
    return buildFallbackRecipe({ url, reason: 'caption_processing_failed' });
  }
}

function buildFallbackRecipe({ url, reason }) {
  const baseMacros = { calories: 480, protein: 30, carbs: 40, fat: 18 };
  return {
    title: 'Recipe draft (offline fallback)',
    servings: 2,
    ingredients: [
      { name: 'Protein of choice (chicken, tofu, etc.)', quantity: '400 g' },
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
      'Fallback recipe used because video analysis was unavailable.',
      reason === 'no_recipe_in_caption'
        ? 'Video caption did not contain recipe details.'
        : 'Please check the original video to adjust ingredients and steps.',
    ],
    confidence: {
      source: 'fallback-heuristic',
      videoAnalysis: false,
      reason: reason || 'unknown'
    },
    sourceUrl: url
  };
}

function getLlmConfig() {
  return {
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  };
}

/**
 * Modify a recipe using Gemini with constraint-based micro-edits
 * @param {Object} recipe - Original recipe object
 * @param {string} goalType - 'bulk' | 'lean_bulk' | 'cut'
 * @param {Object} userContext - Quiz-derived user info (allergens, stats, preferences)
 * @returns {Promise<Object>} Modification result with edits and analysis
 */
export async function modifyRecipeForGoal(recipe, goalType, userContext = {}) {
  const config = getLlmConfig();
  const totalStart = Date.now();
  let macroMs = 0;
  let substitutionMs = 0;
  let geminiMs = 0;
  const safeUserContext = normalizeUserContext(userContext);

  try {
    console.info('[llm] modifying recipe for goal:', goalType);
    console.info('[llm] recipe title:', recipe.title);
    console.info('[llm] current macros:', JSON.stringify(recipe.macros));

    let substitutionPlan = {
      ingredients: [],
      warnings: ['FDC_API_KEY missing; substitutions limited to portion tweaks.'],
      assumptions: [],
    };

    if (hasFdcKey()) {
      try {
        const macroStart = Date.now();
        const macroEstimate = await estimateMacros(recipe, {
          includeYieldFactors: true,
          recipeSteps: recipe.steps || [],
        });
        macroMs = Date.now() - macroStart;

        const substitutionStart = Date.now();
        substitutionPlan = await buildSubstitutionPlan(recipe, goalType, safeUserContext, macroEstimate);
        substitutionMs = Date.now() - substitutionStart;
      } catch (err) {
        console.warn('[llm] substitution plan failed:', err?.message);
        substitutionPlan.warnings = [`Substitution plan unavailable: ${err?.message ?? 'unknown error'}`];
      }
    }

    const genAI = createClient();
    const model = genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent, deterministic edits
        responseMimeType: 'application/json'
      }
    });

    const prompt = buildModificationPrompt(recipe, goalType, safeUserContext, substitutionPlan);
    const geminiStart = Date.now();
    const result = await model.generateContent(prompt);
    geminiMs = Date.now() - geminiStart;
    const response = result.response;
    const message = response.text();

    if (!message) {
      throw new Error('Recipe modification model returned no content.');
    }

    const parsed = JSON.parse(message);
    parsed.substitutionPlan = substitutionPlan;

    // Log the results
    console.info('[llm] recipe modified successfully');
    console.info('[llm] edits made:', parsed.edits?.length || 0);
    console.info('[llm] new macros:', JSON.stringify(parsed.summary?.newMacros));
    const totalMs = Date.now() - totalStart;
    console.info('[llm] timings (ms):', {
      macro: macroMs,
      substitution: substitutionMs,
      gemini: geminiMs,
      total: totalMs,
    });

    return parsed;

  } catch (err) {
    console.error('[llm] recipe modification failed:', err?.message ?? err);
    throw new Error(`Failed to modify recipe: ${err?.message ?? 'Unknown error'}`);
  }
}

const SYSTEM_PROMPT = `
You are a culinary AI that turns cooking videos into detailed, editable recipes with macros.

You have been given a complete cooking video. Analyze the ENTIRE video including:
- Audio narration and dialogue (transcribe what you hear)
- Visual ingredients and their quantities shown or mentioned
- Cooking techniques, methods, and timing
- On-screen text, labels, and measurements
- The sequence of steps from start to finish

Respond ONLY with a JSON object matching this exact shape:
{
  "title": string,
  "servings": number,
  "ingredients": [{ "name": string, "quantity": string }],
  "steps": [string],
  "times": { "prepMinutes": number, "cookMinutes": number },
  "macros": { "calories": number, "protein": number, "carbs": number, "fat": number },
  "assumptions": [string],
  "confidence": { "source": "gemini-video", "videoLengthSeconds": number, "audioDetected": boolean, "ingredientsVisible": boolean }
}

Rules:
- Extract exact quantities from audio narration or on-screen text when available
- If quantities are missing, infer realistic amounts based on visual context; note these as assumptions
- Include numbered, clear cooking steps (1 step per array item) in chronological order
- Macros should be per serving; state assumptions when estimating hidden ingredients (oils, sauces, seasonings)
- If the video mentions dietary restrictions or allergens to avoid, respect those in your analysis
- For timing: prepMinutes = prep work before heat, cookMinutes = active cooking time
- Be specific with ingredient names (e.g., "all-purpose flour" not just "flour")
- Include cooking temperatures if mentioned (e.g., "Preheat oven to 350°F")
`;
