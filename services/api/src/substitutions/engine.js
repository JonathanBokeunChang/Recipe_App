import { estimateMacros, normalizeRecipeIngredients } from '../macros.js';
import { hasFdcKey, findFood } from '../fdc.js';
import { getCandidatesForRoles } from './catalog.js';
import { createLimiter } from '../utils/concurrency.js';

const CANDIDATE_FOOD_CACHE = new Map();
const CANDIDATE_FOOD_CACHE_MAX = 200;

/**
 * Build a data-backed substitution plan using USDA matches and curated candidates.
 * Returns per-ingredient candidates with macro deltas and taste/texture signals.
 */
export async function buildSubstitutionPlan(
  recipe,
  goalType,
  userContext = {},
  macroEstimate = null
) {
  if (!hasFdcKey()) {
    return {
      ingredients: [],
      warnings: ['FDC_API_KEY missing; substitution candidates limited to portion tweaks.'],
      assumptions: [],
      confidence: 'low',
    };
  }

  const normalizedIngredients = normalizeRecipeIngredients(recipe);

  let macroData = macroEstimate;
  if (!macroData) {
    try {
      macroData = await estimateMacros(recipe, {
        includeYieldFactors: true,
        recipeSteps: recipe.steps || [],
      });
    } catch (err) {
      return {
        ingredients: [],
        warnings: [`Macro estimation failed: ${err.message}`],
        assumptions: [],
        confidence: 'low',
      };
    }
  }

  const candidateCache = new Map();
  const plan = {
    ingredients: [],
    warnings: [...(macroData.warnings || [])],
    assumptions: [...(macroData.assumptions || [])],
    confidence: macroData.confidence?.overall || 'medium',
  };

  for (let i = 0; i < normalizedIngredients.length; i++) {
    const parsed = normalizedIngredients[i];
    const macroInfo = macroData.ingredients?.[i] || {};

    const baseMacros = macroInfo.macros || null;
    const baseGrams = macroInfo.grams || null;

    const shouldSkip = shouldSkipSubstitutions(parsed?.name, baseMacros);
    const roles = shouldSkip ? [] : inferRoles(parsed, macroInfo.fdcMatch, baseMacros);

    let candidates = [];
    let notes = [];

    if (!shouldSkip && roles.length && baseMacros && baseGrams) {
      candidates = await buildCandidatesForIngredient({
        parsed,
        macroInfo,
        roles,
        goalType,
        userContext,
        candidateCache,
      });

      if (!candidates.length) {
        notes.push('No safe USDA-backed swaps; use portion adjustments/adds instead.');
      }
    } else {
      notes.push('Skip substitutions (minimal macro impact or no reliable USDA match).');
    }

    plan.ingredients.push({
      name: parsed?.name,
      original: parsed?.original,
      roles,
      baseMacros: baseMacros ? roundMacros(baseMacros) : null,
      baseGrams: baseGrams ? round(baseGrams, 1) : null,
      fdcMatch: macroInfo.fdcMatch || null,
      gramsConfidence: macroInfo.gramsConfidence || null,
      candidates,
      notes,
    });
  }

  return plan;
}

async function buildCandidatesForIngredient({
  parsed,
  macroInfo,
  roles,
  goalType,
  userContext,
  candidateCache,
}) {
  const baseMacros = macroInfo.macros;
  const baseGrams = macroInfo.grams;

  const catalogCandidates = getCandidatesForRoles(roles);
  const allowed = catalogCandidates.filter((cand) =>
    isCandidateAllowed(cand, userContext, parsed?.name)
  );

  const limiter = createLimiter(6);
  const scoredResults = await Promise.all(
    allowed.map((candidate) =>
      limiter(async () => {
        const food = await loadCandidateFood(candidate, candidateCache);
        if (!food?.nutrients) return null;

        const swapGrams = Math.max(baseGrams * (candidate.gramRatio || 1), 1);
        const candidateMacros = scaleNutrients(food.nutrients, swapGrams);
        const macroDelta = diffMacros(candidateMacros, baseMacros);
        const goalFit = computeGoalFit(macroDelta, goalType, baseMacros);

        const tasteTextureScore = ((candidate.tasteScore || 3) + (candidate.textureScore || 3)) / 10;
        const commonnessScore = (candidate.commonness || 3) / 5;
        const safetyScore = candidate.allergens?.length ? 0.8 : 1;

        const score = round(
          tasteTextureScore * 0.45 +
          commonnessScore * 0.2 +
          goalFit * 0.3 +
          safetyScore * 0.05,
          3
        );

        return {
          id: candidate.id,
          name: candidate.name,
          role: roles[0],
          swapGrams: round(swapGrams, 1),
          macroPerSwap: roundMacros(candidateMacros),
          macroDelta: roundMacros(macroDelta),
          tasteScore: candidate.tasteScore,
          textureScore: candidate.textureScore,
          commonness: candidate.commonness,
          goalFitScore: round(goalFit * 100, 1),
          score,
          caution: candidate.notes || null,
          fdcMatch: {
            fdcId: food.fdcId,
            description: food.description,
            dataType: food.dataType,
            category: food.category,
          },
        };
      })
    )
  );

  const scored = scoredResults.filter(Boolean);

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

async function loadCandidateFood(candidate, cache) {
  if (cache.has(candidate.id)) {
    return cache.get(candidate.id);
  }

  const globallyCached = getCachedCandidateFood(candidate.id);
  if (globallyCached) {
    cache.set(candidate.id, globallyCached);
    return globallyCached;
  }

  const queries = candidate.fdcQueries || [candidate.name];
  const food = await findFood(candidate.name, queries, { dataTypes: ['Foundation', 'SR Legacy'] });

  if (food) {
    cache.set(candidate.id, food);
    setCachedCandidateFood(candidate.id, food);
  }

  return food;
}

function shouldSkipSubstitutions(name, baseMacros) {
  const lower = (name || '').toLowerCase();
  const skipKeywords = ['salt', 'pepper', 'water', 'vanilla', 'baking powder', 'baking soda', 'yeast', 'spice', 'seasoning'];
  if (skipKeywords.some((kw) => lower.includes(kw))) return true;

  if (baseMacros && (baseMacros.calories || 0) <= 5) {
    return true; // negligible macro impact
  }

  return false;
}

function inferRoles(parsed, fdcMatch, baseMacros) {
  const roles = new Set();
  const name = (parsed?.name || '').toLowerCase();
  const category = (fdcMatch?.category || fdcMatch?.description || '').toLowerCase();

  if (name.includes('chicken') || category.includes('poultry')) roles.add('poultry');
  if (name.includes('turkey')) roles.add('poultry');
  if (name.includes('beef') || category.includes('beef')) roles.add('red_meat');
  if (name.includes('pork') || category.includes('pork')) roles.add('pork');
  if (category.includes('finfish') || category.includes('fish')) roles.add('seafood');
  if (category.includes('shellfish') || name.includes('shrimp')) roles.add('seafood');
  if (category.includes('soy') || name.includes('tofu') || name.includes('tempeh')) roles.add('plant_protein');
  if (category.includes('legume') || name.includes('bean') || name.includes('lentil')) roles.add('plant_protein');

  if (category.includes('fats and oils') || name.includes('oil') || name.includes('butter') || name.includes('ghee')) {
    roles.add('fat_oil');
  }
  if (name.includes('avocado')) roles.add('fat_oil');

  if (category.includes('dairy') || name.includes('cheese') || name.includes('milk') || name.includes('yogurt')) {
    roles.add('creamy_dairy');
    if (name.includes('cheese')) roles.add('cheese');
  }
  if (name.includes('egg')) roles.add('binder');

  if (category.includes('cereal') || category.includes('pasta') || name.includes('rice') || name.includes('pasta') || name.includes('noodle')) {
    roles.add('carb_base');
  }
  if (name.includes('tortilla') || name.includes('bread')) roles.add('bread_wrap');
  if (name.includes('quinoa') || name.includes('oats')) roles.add('carb_base');
  if (name.includes('cauliflower') || name.includes('zucchini')) roles.add('low_carb_base');

  // Lean vs fatty protein inference
  if (baseMacros) {
    const protein = baseMacros.protein || 0;
    const fat = baseMacros.fat || 0;
    if (protein >= 15 && fat <= 8) roles.add('lean_protein');
    if (protein >= 12 && fat <= 5 && (category.includes('ground') || name.includes('ground'))) {
      roles.add('lean_ground');
    }
  }

  return Array.from(roles);
}

function isCandidateAllowed(candidate, userContext, originalName = '') {
  const allergens = new Set((userContext.allergens || []).map((a) => String(a).toLowerCase().trim()));
  const diet = (userContext.dietStyle || '').toLowerCase();
  const avoidText = (userContext.avoidList || '').toLowerCase();
  const avoidTerms = avoidText ? avoidText.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
  const conditions = new Set(
    Array.isArray(userContext.conditions)
      ? userContext.conditions.map((c) => String(c).toLowerCase().trim())
      : []
  );
  const candidateName = (candidate.name || '').toLowerCase();

  if (candidate.allergens?.length) {
    for (const allergen of candidate.allergens) {
      const lower = allergen.toLowerCase();
      if (lower === 'gluten_optional') {
        if (allergens.has('gluten')) return false;
        continue;
      }
      if (allergens.has(lower)) return false;
      if (lower === 'legume' && allergens.has('peanut')) return false;
    }
  }

  if (diet) {
    if (diet === 'vegan' && !candidate.diets?.includes('vegan')) return false;
    if (diet === 'vegetarian' && !(candidate.diets?.includes('vegetarian') || candidate.diets?.includes('vegan'))) {
      return false;
    }
    if (diet === 'pescatarian') {
      const isSeafood = candidate.roles.includes('seafood');
      const plantOk = candidate.diets?.some((d) => d === 'vegan' || d === 'vegetarian');
      if (!isSeafood && !plantOk) return false;
    }
    if (diet === 'dairy_free' && candidate.allergens?.includes('dairy')) return false;
  }

  for (const term of avoidTerms) {
    if (!term) continue;
    if (candidateName.includes(term)) return false;
  }

  // Medical condition guardrails (lightweight filtering)
  if (conditions.has('celiac')) {
    const glutenHits = ['flour', 'wheat', 'barley', 'rye', 'malt', 'bread', 'panko'];
    if (glutenHits.some((kw) => candidateName.includes(kw))) return false;
  }
  if (conditions.has('diabetes')) {
    const sugarHits = ['sugar', 'syrup', 'honey', 'sweetened'];
    if (sugarHits.some((kw) => candidateName.includes(kw))) return false;
  }
  if (conditions.has('hypertension')) {
    const sodiumHits = ['soy sauce', 'salt', 'bacon', 'sausage', 'ham', 'broth', 'bouillon', 'cured'];
    if (sodiumHits.some((kw) => candidateName.includes(kw))) return false;
  }
  if (conditions.has('high_cholesterol')) {
    const satFatHits = ['butter', 'cream', 'cheese', 'bacon', 'sausage', 'ribeye', 'short rib', 'pork belly', 'lard', 'ghee'];
    if (satFatHits.some((kw) => candidateName.includes(kw))) return false;
  }
  if (conditions.has('kidney')) {
    const renalHits = ['soy sauce', 'salt', 'broth', 'spinach', 'tomato', 'potato', 'beans', 'lentil', 'avocado'];
    if (renalHits.some((kw) => candidateName.includes(kw))) return false;
  }

  // Avoid suggesting the exact same ingredient
  if (originalName && candidateName.includes(originalName.toLowerCase())) {
    return false;
  }

  return true;
}

function computeGoalFit(delta, goalType, baseMacros = {}) {
  const calories = delta.calories || 0;
  const protein = delta.protein || 0;
  const fat = delta.fat || 0;
  const carbs = delta.carbs || 0;

  if (goalType === 'bulk') {
    const calScore = normalizePositive(calories, 250);
    const proteinScore = normalizePositive(protein, 12);
    const fatScore = normalizePositive(fat, 8);
    return clamp(0.45 * calScore + 0.4 * proteinScore + 0.15 * fatScore, 0, 1);
  }

  if (goalType === 'lean_bulk') {
    const calScore = normalizeBand(calories, 75, 200);
    const proteinScore = normalizePositive(protein, 12);
    const fatPenalty = normalizeNegative(fat, 10) * 0.5;
    return clamp(0.45 * proteinScore + 0.35 * calScore + 0.2 * (1 - fatPenalty), 0, 1);
  }

  if (goalType === 'cut') {
    const calScore = normalizeNegative(calories, 180);
    const fatScore = normalizeNegative(fat, 10);
    const carbScore = normalizeNegative(carbs, 25);
    const proteinGuard = protein >= -3 ? 1 : 1 - normalizeNegative(protein, 8);
    return clamp(0.4 * calScore + 0.25 * fatScore + 0.2 * proteinGuard + 0.15 * carbScore, 0, 1);
  }

  return 0.3; // default neutral
}

function normalizePositive(delta, target) {
  if (delta <= 0) return 0;
  return clamp(delta / target, 0, 1);
}

function normalizeNegative(delta, target) {
  if (delta >= 0) return 0;
  return clamp(Math.abs(delta) / target, 0, 1);
}

function normalizeBand(delta, low, high) {
  if (delta <= 0) return 0;
  if (delta >= high) return 1;
  return clamp((delta - low) / (high - low), 0, 1);
}

function scaleNutrients(nutrients, grams) {
  const factor = grams / 100;
  return {
    calories: (nutrients.calories || 0) * factor,
    protein: (nutrients.protein || 0) * factor,
    carbs: (nutrients.carbs || 0) * factor,
    fat: (nutrients.fat || 0) * factor,
    fiber: (nutrients.fiber || 0) * factor,
    sodium: (nutrients.sodium || 0) * factor,
  };
}

function diffMacros(a = {}, b = {}) {
  return {
    calories: (a.calories || 0) - (b.calories || 0),
    protein: (a.protein || 0) - (b.protein || 0),
    carbs: (a.carbs || 0) - (b.carbs || 0),
    fat: (a.fat || 0) - (b.fat || 0),
    fiber: (a.fiber || 0) - (b.fiber || 0),
    sodium: (a.sodium || 0) - (b.sodium || 0),
  };
}

function roundMacros(macros = {}) {
  return {
    calories: round(macros.calories, 0),
    protein: round(macros.protein, 1),
    carbs: round(macros.carbs, 1),
    fat: round(macros.fat, 1),
    fiber: round(macros.fiber, 1),
    sodium: round(macros.sodium, 0),
  };
}

function round(value, decimals = 1) {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCachedCandidateFood(id) {
  const cached = CANDIDATE_FOOD_CACHE.get(id);
  if (!cached) return null;
  return cached;
}

function setCachedCandidateFood(id, food) {
  if (CANDIDATE_FOOD_CACHE.size >= CANDIDATE_FOOD_CACHE_MAX) {
    const oldest = CANDIDATE_FOOD_CACHE.keys().next().value;
    CANDIDATE_FOOD_CACHE.delete(oldest);
  }
  CANDIDATE_FOOD_CACHE.set(id, food);
}
