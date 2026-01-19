/**
 * High-Accuracy Macro Calculation System
 *
 * Multi-stage pipeline for accurate nutrition estimation:
 * 1. Ingredient normalization (clean text, extract quantities)
 * 2. USDA FDC search with scoring and ranking
 * 3. Portion data from USDA when available
 * 4. Density tables for volumetric conversions
 * 5. Yield factors for cooked vs raw adjustments
 * 6. Confidence scoring for each ingredient
 */

import { hasFdcKey, findFood, getPortionGrams } from './fdc.js';
import { parseIngredient, normalizeRecipeIngredients } from './ingredient-normalizer.js';
import { volumeToGrams, getDensityData } from './density-tables.js';
import {
  getYieldFactor,
  analyzeIngredientCookingState,
  adjustMacrosForCooking,
} from './yield-factors.js';
import { createLimiter } from './utils/concurrency.js';

// Default nutrient values per 100g (for when all else fails)
const FALLBACK_NUTRIENTS = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sodium: 0,
};

// Cache ingredient-level macro calculations to avoid repeated USDA calls
const INGREDIENT_CACHE = new Map();
const INGREDIENT_CACHE_MAX = 500;

/**
 * Main entry point: Estimate macros for a recipe with high accuracy
 *
 * @param {Object} recipe - Recipe object with ingredients and servings
 * @param {Object} options - Additional options
 * @returns {Object} Comprehensive macro estimation result
 */
export async function estimateMacros(recipe, options = {}) {
  if (!hasFdcKey()) {
    throw new Error('FDC_API_KEY missing; cannot estimate macros.');
  }

  const {
    includeYieldFactors = true,
    recipeSteps = recipe.steps || [],
    concurrencyLimit = 6,
  } = options;

  // Initialize result structure
  const result = {
    totals: { ...FALLBACK_NUTRIENTS },
    perServing: { ...FALLBACK_NUTRIENTS },
    ingredients: [],
    assumptions: [],
    warnings: [],
    confidence: {
      overall: 'high',
      score: 100,
      factors: [],
    },
  };

  // Normalize all ingredients
  const normalizedIngredients = normalizeRecipeIngredients(recipe);

  if (!normalizedIngredients.length) {
    result.warnings.push('No ingredients found in recipe');
    result.confidence.overall = 'low';
    result.confidence.score = 0;
    return result;
  }

  const limiter = createLimiter(concurrencyLimit);

  const ingredientResults = await Promise.all(
    normalizedIngredients.map((parsed) =>
      limiter(async () => {
        const cacheKey = buildIngredientCacheKey(parsed, includeYieldFactors, recipeSteps);
        const cached = getCachedIngredient(cacheKey);
        if (cached) return cached;

        const computed = await processIngredient(parsed, {
          includeYieldFactors,
          recipeSteps,
        });
        setCachedIngredient(cacheKey, computed);
        return computed;
      })
    )
  );

  result.ingredients.push(...ingredientResults);

  for (const ingredientResult of ingredientResults) {
    if (ingredientResult.macros) {
      result.totals.calories += ingredientResult.macros.calories || 0;
      result.totals.protein += ingredientResult.macros.protein || 0;
      result.totals.carbs += ingredientResult.macros.carbs || 0;
      result.totals.fat += ingredientResult.macros.fat || 0;
      result.totals.fiber += ingredientResult.macros.fiber || 0;
      result.totals.sodium += ingredientResult.macros.sodium || 0;
    }

    if (ingredientResult.assumptions?.length) {
      result.assumptions.push(...ingredientResult.assumptions);
    }
    if (ingredientResult.warnings?.length) {
      result.warnings.push(...ingredientResult.warnings);
    }
  }

  // Calculate per-serving values
  const servings = getServingCount(recipe);
  result.perServing = divideTotals(result.totals, servings);
  result.servings = servings;

  // Validate calorie calculation
  const calorieValidation = validateCalories(result.perServing);
  if (calorieValidation.warning) {
    result.warnings.push(calorieValidation.warning);
  }

  // Calculate overall confidence
  result.confidence = calculateOverallConfidence(result.ingredients);

  // Round all values
  result.totals = roundMacros(result.totals);
  result.perServing = roundMacros(result.perServing);

  return result;
}

/**
 * Process a single ingredient through the full pipeline
 */
async function processIngredient(parsed, options = {}) {
  const result = {
    original: parsed.original,
    name: parsed.name,
    quantity: parsed.quantity,
    unit: parsed.unit,
    grams: null,
    fdcMatch: null,
    macros: null,
    confidence: 'low',
    assumptions: [],
    warnings: [],
  };

  // Step 1: Find USDA food match
  const fdcFood = await findFdcMatch(parsed);

  if (!fdcFood) {
    result.warnings.push(`No USDA match found for "${parsed.name}"`);
    result.confidence = 'failed';
    return result;
  }

  result.fdcMatch = {
    fdcId: fdcFood.fdcId,
    description: fdcFood.description,
    dataType: fdcFood.dataType,
    matchScore: fdcFood.matchScore,
    confidence: fdcFood.confidence,
  };

  // Step 2: Convert quantity to grams
  const gramsResult = await convertToGrams(parsed, fdcFood);
  result.grams = gramsResult.grams;
  result.gramsConfidence = gramsResult.confidence;

  if (gramsResult.assumption) {
    result.assumptions.push(gramsResult.assumption);
  }
  if (gramsResult.warning) {
    result.warnings.push(gramsResult.warning);
  }

  if (!result.grams || result.grams <= 0) {
    result.warnings.push(`Could not determine weight for "${parsed.name}"`);
    result.confidence = 'failed';
    return result;
  }

  // Step 3: Calculate base macros from USDA nutrients
  const nutrients = fdcFood.nutrients || {};
  const macrosPer100g = {
    calories: nutrients.calories || 0,
    protein: nutrients.protein || 0,
    carbs: nutrients.carbs || 0,
    fat: nutrients.fat || 0,
    fiber: nutrients.fiber || 0,
    sodium: nutrients.sodium || 0,
  };

  // Step 4: Apply yield factors if cooking state differs
  let finalMacros;
  if (options.includeYieldFactors) {
    const cookingState = analyzeIngredientCookingState(parsed.original, options.recipeSteps);

    if (cookingState.isCooked && cookingState.method !== 'raw') {
      const adjusted = adjustMacrosForCooking(
        scaleToAmount(macrosPer100g, result.grams),
        result.grams,
        parsed.name,
        cookingState.method
      );

      finalMacros = adjusted.total;
      result.yieldAdjustment = {
        method: cookingState.method,
        factor: adjusted.yieldFactor,
        rawGrams: result.grams,
        cookedGrams: adjusted.cookedGrams,
      };
      result.assumptions.push(
        `Applied ${cookingState.method} yield factor (${adjusted.yieldFactor.toFixed(2)}) for "${parsed.name}"`
      );
    } else {
      finalMacros = scaleToAmount(macrosPer100g, result.grams);
    }
  } else {
    finalMacros = scaleToAmount(macrosPer100g, result.grams);
  }

  result.macros = finalMacros;

  // Step 5: Determine overall ingredient confidence
  result.confidence = determineIngredientConfidence(result);

  // Add detailed assumption about this ingredient
  result.assumptions.unshift(
    `"${parsed.original}" → ${result.grams.toFixed(1)}g of "${fdcFood.description}" (${fdcFood.dataType})`
  );

  return result;
}

/**
 * Find the best USDA FDC match for an ingredient
 */
async function findFdcMatch(parsed) {
  try {
    return await findFood(parsed.name, parsed.searchQueries || []);
  } catch (err) {
    console.warn(`[macros] FDC search failed for "${parsed.name}":`, err.message);
    return null;
  }
}

/**
 * Convert ingredient quantity to grams using multiple strategies
 */
async function convertToGrams(parsed, fdcFood) {
  const { quantity, unit, name } = parsed;

  // If no quantity, try to infer from context
  if (!quantity || quantity <= 0) {
    return {
      grams: null,
      confidence: 'failed',
      warning: `No quantity specified for "${name}"`,
    };
  }

  // Strategy 1: Direct weight units (g, kg, oz, lb)
  const weightUnits = {
    g: 1, gram: 1, grams: 1,
    kg: 1000, kilogram: 1000,
    mg: 0.001, milligram: 0.001,
    oz: 28.3495, ounce: 28.3495,
    lb: 453.592, pound: 453.592, lbs: 453.592,
  };

  const normalizedUnit = (unit || '').toLowerCase().trim();

  if (weightUnits[normalizedUnit]) {
    return {
      grams: quantity * weightUnits[normalizedUnit],
      confidence: 'high',
      source: 'weight_unit',
      assumption: `${quantity} ${unit} = ${(quantity * weightUnits[normalizedUnit]).toFixed(1)}g (direct weight)`,
    };
  }

  // Strategy 2: USDA portion data (most accurate for volumetric)
  if (fdcFood && unit) {
    const portionResult = getPortionGrams(fdcFood, unit, quantity);
    if (portionResult) {
      return {
        grams: portionResult.grams,
        confidence: 'high',
        source: 'usda_portion',
        assumption: `${quantity} ${unit} = ${portionResult.grams.toFixed(1)}g (USDA: ${portionResult.portionDescription})`,
      };
    }
  }

  // Strategy 3: Density tables
  if (unit) {
    const densityResult = volumeToGrams(
      quantity,
      unit,
      name,
      fdcFood?.description
    );

    if (densityResult.grams && densityResult.confidence !== 'failed') {
      return {
        grams: densityResult.grams,
        confidence: densityResult.confidence,
        source: densityResult.densitySource,
        assumption: `${quantity} ${unit} = ${densityResult.grams.toFixed(1)}g (density table: ${densityResult.densitySource})`,
        warning: densityResult.warning,
      };
    }
  }

  // Strategy 4: Count-based (pieces, whole, each)
  const countUnits = ['piece', 'pieces', 'whole', 'each', 'slice', 'slices'];
  if (countUnits.includes(normalizedUnit)) {
    // Try to get average weight from USDA portions
    if (fdcFood?.portions?.length) {
      const portionWeight = fdcFood.portions[0].gramsPerUnit;
      return {
        grams: quantity * portionWeight,
        confidence: 'medium',
        source: 'usda_portion_count',
        assumption: `${quantity} ${unit} = ${(quantity * portionWeight).toFixed(1)}g (USDA average portion)`,
      };
    }

    // Fallback estimates for common countable items
    const countEstimates = {
      egg: 50,
      banana: 120,
      apple: 180,
      orange: 130,
      lemon: 60,
      lime: 45,
      clove: 3, // garlic
      slice: 30, // bread
    };

    for (const [key, grams] of Object.entries(countEstimates)) {
      if (name.toLowerCase().includes(key)) {
        return {
          grams: quantity * grams,
          confidence: 'medium',
          source: 'count_estimate',
          assumption: `${quantity} ${name} ≈ ${(quantity * grams).toFixed(1)}g (estimated)`,
        };
      }
    }
  }

  // Strategy 5: No unit - assume grams if numeric only
  if (!unit && quantity > 0) {
    // Small numbers likely count, large numbers likely grams
    if (quantity <= 10) {
      // Probably a count - try to estimate
      return {
        grams: quantity * 50, // Very rough estimate
        confidence: 'low',
        source: 'count_fallback',
        assumption: `${quantity} × ~50g estimated for "${name}"`,
        warning: `Assumed ${quantity} ${name} as count, not weight`,
      };
    } else {
      // Probably grams
      return {
        grams: quantity,
        confidence: 'medium',
        source: 'assumed_grams',
        assumption: `${quantity} assumed to be grams for "${name}"`,
      };
    }
  }

  // Fallback: could not determine
  return {
    grams: null,
    confidence: 'failed',
    warning: `Could not convert "${quantity} ${unit || ''}" to grams for "${name}"`,
  };
}

/**
 * Scale nutrients from per-100g to actual amount
 */
function scaleToAmount(nutrientsPer100g, grams) {
  const factor = grams / 100;
  return {
    calories: (nutrientsPer100g.calories || 0) * factor,
    protein: (nutrientsPer100g.protein || 0) * factor,
    carbs: (nutrientsPer100g.carbs || 0) * factor,
    fat: (nutrientsPer100g.fat || 0) * factor,
    fiber: (nutrientsPer100g.fiber || 0) * factor,
    sodium: (nutrientsPer100g.sodium || 0) * factor,
  };
}

/**
 * Determine confidence level for a single ingredient
 */
function determineIngredientConfidence(ingredientResult) {
  const { fdcMatch, gramsConfidence } = ingredientResult;

  if (!fdcMatch || !ingredientResult.grams) {
    return 'failed';
  }

  // Score based on FDC match quality
  let score = fdcMatch.matchScore || 0;

  // Adjust for grams conversion confidence
  const gramsMultiplier = {
    high: 1.0,
    medium: 0.8,
    low: 0.5,
    failed: 0,
  };
  score *= gramsMultiplier[gramsConfidence] || 0.5;

  // Convert to confidence level
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Calculate overall recipe confidence
 */
function calculateOverallConfidence(ingredients) {
  const confidenceScores = {
    high: 100,
    medium: 60,
    low: 30,
    failed: 0,
  };

  let totalScore = 0;
  let weightedCount = 0;
  const factors = [];

  for (const ing of ingredients) {
    const score = confidenceScores[ing.confidence] || 0;
    const weight = ing.macros?.calories || 10; // Weight by caloric contribution

    totalScore += score * weight;
    weightedCount += weight;

    if (ing.confidence !== 'high') {
      factors.push({
        ingredient: ing.name,
        confidence: ing.confidence,
        reason: ing.warnings?.[0] || 'Lower confidence match',
      });
    }
  }

  const avgScore = weightedCount > 0 ? totalScore / weightedCount : 0;

  let overall;
  if (avgScore >= 70) overall = 'high';
  else if (avgScore >= 50) overall = 'medium';
  else overall = 'low';

  // Count failed ingredients
  const failedCount = ingredients.filter(i => i.confidence === 'failed').length;
  if (failedCount > 0) {
    factors.unshift({
      ingredient: `${failedCount} ingredient(s)`,
      confidence: 'failed',
      reason: 'Could not calculate macros',
    });

    // Downgrade if significant portion failed
    if (failedCount / ingredients.length > 0.3) {
      overall = 'low';
    }
  }

  return {
    overall,
    score: Math.round(avgScore),
    factors: factors.slice(0, 5), // Top 5 confidence issues
    ingredientBreakdown: {
      high: ingredients.filter(i => i.confidence === 'high').length,
      medium: ingredients.filter(i => i.confidence === 'medium').length,
      low: ingredients.filter(i => i.confidence === 'low').length,
      failed: failedCount,
    },
  };
}

/**
 * Validate calories match macro-derived calculation
 */
function validateCalories(macros) {
  const calculatedCalories =
    (macros.protein || 0) * 4 +
    (macros.carbs || 0) * 4 +
    (macros.fat || 0) * 9;

  const statedCalories = macros.calories || 0;

  if (statedCalories === 0) {
    return { valid: true };
  }

  const difference = Math.abs(calculatedCalories - statedCalories);
  const percentDiff = difference / Math.max(statedCalories, 1);

  if (percentDiff > 0.15) {
    return {
      valid: false,
      warning: `Calorie calculation differs from USDA by ${Math.round(percentDiff * 100)}% ` +
        `(USDA: ${statedCalories.toFixed(0)}, Macro-derived: ${calculatedCalories.toFixed(0)}). ` +
        `This may indicate missing nutrients or measurement uncertainty.`,
    };
  }

  return { valid: true };
}

/**
 * Get serving count from recipe
 */
function getServingCount(recipe) {
  if (recipe.servings && Number.isFinite(recipe.servings) && recipe.servings > 0) {
    return recipe.servings;
  }
  return 1;
}

/**
 * Divide totals by serving count
 */
function divideTotals(totals, servings) {
  return {
    calories: totals.calories / servings,
    protein: totals.protein / servings,
    carbs: totals.carbs / servings,
    fat: totals.fat / servings,
    fiber: totals.fiber / servings,
    sodium: totals.sodium / servings,
  };
}

/**
 * Round macros to reasonable precision
 */
function roundMacros(macros) {
  return {
    calories: round(macros.calories, 0),
    protein: round(macros.protein, 1),
    carbs: round(macros.carbs, 1),
    fat: round(macros.fat, 1),
    fiber: round(macros.fiber, 1),
    sodium: round(macros.sodium, 0),
  };
}

/**
 * Round to specified decimal places
 */
function round(value, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function buildIngredientCacheKey(parsed, includeYieldFactors, recipeSteps = []) {
  const stepSignature = (recipeSteps || [])
    .slice(0, 8)
    .map(s => String(s).toLowerCase().slice(0, 80))
    .join('|');

  return [
    parsed.original,
    parsed.name,
    parsed.quantity,
    parsed.unit,
    parsed.cookedState,
    includeYieldFactors ? 'yield' : 'no_yield',
    stepSignature,
  ].join('::');
}

function getCachedIngredient(key) {
  const cached = INGREDIENT_CACHE.get(key);
  if (!cached) return null;
  return cloneIngredientResult(cached);
}

function setCachedIngredient(key, value) {
  if (INGREDIENT_CACHE.size >= INGREDIENT_CACHE_MAX) {
    const oldest = INGREDIENT_CACHE.keys().next().value;
    INGREDIENT_CACHE.delete(oldest);
  }
  INGREDIENT_CACHE.set(key, value);
}

function cloneIngredientResult(result) {
  return JSON.parse(JSON.stringify(result));
}

// ============================================
// Quick estimation (simpler, faster)
// ============================================

/**
 * Quick macro estimation for real-time updates
 * Uses cached data and simpler calculations
 */
export async function quickEstimate(recipe) {
  try {
    const result = await estimateMacros(recipe, {
      includeYieldFactors: false, // Skip for speed
    });

    return {
      perServing: result.perServing,
      confidence: result.confidence.overall,
      warnings: result.warnings.slice(0, 3),
    };
  } catch (err) {
    console.error('[macros] Quick estimate failed:', err.message);
    return {
      perServing: FALLBACK_NUTRIENTS,
      confidence: 'failed',
      warnings: [err.message],
    };
  }
}

// ============================================
// Exports
// ============================================

export {
  parseIngredient,
  normalizeRecipeIngredients,
  getDensityData,
  volumeToGrams,
  getYieldFactor,
};
