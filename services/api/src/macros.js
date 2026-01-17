import { hasFdcKey, searchFdcFood } from './fdc.js';

const UNIT_TO_GRAMS = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  mg: 0.001,
  ounce: 28.3495,
  oz: 28.3495,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
  tbsp: 14, // average across oils/butters
  tablespoon: 14,
  tbspn: 14,
  tsp: 5,
  teaspoon: 5,
  cup: 240, // water-like density fallback
};

/**
 * Estimate macros for a recipe using USDA FDC nutrients.
 * @param {Object} recipe - { ingredients: [{ name, quantity }], servings }
 * @returns {Object} totals, perServing, and assumptions/warnings
 */
export async function estimateMacros(recipe) {
  if (!hasFdcKey()) {
    throw new Error('FDC_API_KEY missing; cannot estimate macros.');
  }

  const assumptions = [];
  const warnings = [];
  let totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 };

  for (const ing of recipe.ingredients ?? []) {
    const parsed = parseQuantity(ing.quantity);
    if (!parsed) {
      warnings.push(`Could not parse quantity for "${ing.name}" (${ing.quantity ?? 'n/a'})`);
      continue;
    }

    const food = await safeSearch(ing.name);
    if (!food) {
      warnings.push(`No FDC match for "${ing.name}"`);
      continue;
    }

    const macrosPerGram = scalePerGram(food.nutrients);
    const grams = parsed.grams;

    totals = {
      calories: totals.calories + macrosPerGram.calories * grams,
      protein: totals.protein + macrosPerGram.protein * grams,
      carbs: totals.carbs + macrosPerGram.carbs * grams,
      fat: totals.fat + macrosPerGram.fat * grams,
      fiber: totals.fiber + macrosPerGram.fiber * grams,
      sodium: totals.sodium + macrosPerGram.sodium * grams,
    };

    assumptions.push(
      `Ingredient "${ing.name}" → ${grams.toFixed(1)} g using unit "${parsed.unit}" (FDC: ${food.description})`
    );
  }

  const servings = recipe.servings && Number.isFinite(recipe.servings)
    ? Math.max(1, recipe.servings)
    : 1;

  const perServing = divideTotals(totals, servings);
  const calFromMacros = perServing.protein * 4 + perServing.carbs * 4 + perServing.fat * 9;
  if (Math.abs(calFromMacros - perServing.calories) / Math.max(1, perServing.calories) > 0.1) {
    warnings.push('Calorie sum differs from macro-derived calories by >10% (check quantities).');
  }

  return { totals, perServing, assumptions, warnings };
}

function divideTotals(totals, servings) {
  return {
    calories: round(totals.calories / servings),
    protein: round(totals.protein / servings),
    carbs: round(totals.carbs / servings),
    fat: round(totals.fat / servings),
    fiber: round(totals.fiber / servings),
    sodium: round(totals.sodium / servings),
  };
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function scalePerGram(nutrients = {}) {
  return {
    calories: (nutrients.calories ?? 0) / 100,
    protein: (nutrients.protein ?? 0) / 100,
    carbs: (nutrients.carbs ?? 0) / 100,
    fat: (nutrients.fat ?? 0) / 100,
    fiber: (nutrients.fiber ?? 0) / 100,
    sodium: (nutrients.sodium ?? 0) / 100,
  };
}

function parseQuantity(quantity) {
  if (!quantity || typeof quantity !== 'string') return null;
  const trimmed = quantity.trim().toLowerCase();
  const match = trimmed.match(/^([\d.]+)\s*([a-zA-Z]+)?/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;

  const unit = match[2]?.toLowerCase() ?? 'g';
  const gramsPerUnit = UNIT_TO_GRAMS[unit];
  if (!gramsPerUnit) return null;

  return { grams: value * gramsPerUnit, unit };
}

async function safeSearch(name) {
  try {
    return await searchFdcFood(name);
  } catch (err) {
    console.warn('[fdc] search failed for', name, err?.message);
    return null;
  }
}
