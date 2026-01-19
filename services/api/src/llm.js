import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import './env.js';
import { buildModificationPrompt } from './goals.js';
import { buildSubstitutionPlan } from './substitutions/engine.js';
import { estimateMacros } from './macros.js';
import { hasFdcKey } from './fdc.js';

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

    const prompt = `${SYSTEM_PROMPT}

Video Metadata:
- Title: ${metadata.title || 'Unknown'}
- Author: ${metadata.authorName || 'Unknown'}
- Source: TikTok cooking video

Video Transcript:
${transcript.text}

Extract the recipe from this cooking video transcript. Include all ingredients with quantities, numbered steps in order, estimated times, and macros. Mark any inferred data in assumptions.

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

function normalizeRecipe(recipe, { url, videoAnalysis, transcriptBased, transcriptConfidence }) {
  return {
    title: recipe.title || 'Generated Recipe',
    servings: recipe.servings || 2,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    times: recipe.times || {},
    macros: recipe.macros || {},
    assumptions: recipe.assumptions || [],
    confidence: {
      source: transcriptBased ? 'gemini-transcript' : 'gemini-video',
      videoAnalysis: videoAnalysis,
      transcriptBased: transcriptBased || false,
      transcriptConfidence: transcriptConfidence || undefined,
      ...(recipe.confidence || {})
    },
    sourceUrl: url
  };
}

function buildFallbackRecipe({ url }) {
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
      'Fallback recipe used because Gemini video analysis was unavailable (quota/network).',
      'Please check the original video to adjust ingredients and steps.',
    ],
    confidence: {
      source: 'fallback-heuristic',
      videoAnalysis: false
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
        substitutionPlan = await buildSubstitutionPlan(recipe, goalType, userContext, macroEstimate);
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

    const prompt = buildModificationPrompt(recipe, goalType, userContext, substitutionPlan);
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
