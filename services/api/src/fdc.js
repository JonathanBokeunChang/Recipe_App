/**
 * USDA FoodData Central API Integration
 *
 * Enhanced integration with:
 * - Multi-query search for better matching
 * - Result scoring and ranking
 * - Full food details with portion data
 * - Support for all data types (Foundation, SR Legacy, Branded, FNDDS)
 * - Intelligent caching
 */

import './env.js';

const FDC_API_KEY = process.env.FDC_API_KEY;
const FDC_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// Cache configuration
const cache = new Map();
const TTL_MS = 60 * 60 * 1000; // 1 hour cache

// Nutrient IDs from USDA (more reliable than name matching)
const NUTRIENT_IDS = {
  calories: 1008, // Energy (kcal)
  protein: 1003, // Protein
  carbs: 1005, // Carbohydrate, by difference
  fat: 1004, // Total lipid (fat)
  fiber: 1079, // Fiber, total dietary
  sugar: 2000, // Total Sugars
  sodium: 1093, // Sodium, Na
  saturatedFat: 1258, // Fatty acids, total saturated
  cholesterol: 1253, // Cholesterol
  potassium: 1092, // Potassium, K
  calcium: 1087, // Calcium, Ca
  iron: 1089, // Iron, Fe
  vitaminA: 1106, // Vitamin A, RAE
  vitaminC: 1162, // Vitamin C
  vitaminD: 1114, // Vitamin D (D2 + D3)
};

// Nutrient names as fallback
const NUTRIENT_NAMES = {
  calories: ['Energy', 'Calories'],
  protein: ['Protein'],
  carbs: ['Carbohydrate, by difference', 'Carbohydrates'],
  fat: ['Total lipid (fat)', 'Fat'],
  fiber: ['Fiber, total dietary', 'Dietary Fiber'],
  sugar: ['Total Sugars', 'Sugars'],
  sodium: ['Sodium, Na', 'Sodium'],
  saturatedFat: ['Fatty acids, total saturated', 'Saturated Fat'],
  cholesterol: ['Cholesterol'],
  potassium: ['Potassium, K', 'Potassium'],
  calcium: ['Calcium, Ca', 'Calcium'],
  iron: ['Iron, Fe', 'Iron'],
  vitaminA: ['Vitamin A, RAE', 'Vitamin A'],
  vitaminC: ['Vitamin C, total ascorbic acid', 'Vitamin C'],
  vitaminD: ['Vitamin D (D2 + D3)', 'Vitamin D'],
};

// Data type priorities (higher = better quality for whole foods)
const DATA_TYPE_PRIORITY = {
  'Foundation': 4,
  'SR Legacy': 3,
  'Survey (FNDDS)': 2,
  'Branded': 1,
};

// ============================================
// Cache utilities
// ============================================

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  // Limit cache size
  if (cache.size > 1000) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { value, ts: Date.now() });
}

// ============================================
// HTTP utilities
// ============================================

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FDC API error (${res.status}): ${text}`);
  }

  return res.json();
}

async function postJson(url, body) {
  return fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ============================================
// Query sanitization helpers
// ============================================

function sanitizeSearchQuery(query) {
  if (!query) return '';

  let cleaned = String(query)
    .replace(/%/g, ' percent ')
    .replace(/\([^)]*\)/g, ' ') // drop parentheticals that often contain measurements or alternates
    .replace(/\b\d+(\.\d+)?\s*(g|gram|grams|kg|kilogram|oz|ounce|ounces|lb|pound|pounds|cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|ml|milliliter|millilitre|l|liter|litre)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading numbers that are likely leftover quantities
  cleaned = cleaned.replace(/^(?:\d+\s*)+/, '').trim();

  return cleaned;
}

function simplifyQueryForRetry(query) {
  if (!query) return '';
  const words = query.split(' ').filter(Boolean);
  if (words.length <= 1) return '';

  const filtered = words.filter(w => w.length >= 3 || /[a-zA-Z]/.test(w));
  const simplified = filtered.join(' ').trim();

  if (simplified && simplified !== query) return simplified;
  return words[0];
}

// ============================================
// Search functions
// ============================================

/**
 * Search USDA FDC for foods matching a query
 * @param {string} query - Search term
 * @param {Object} options - Search options
 * @returns {Array} Array of food matches
 */
export async function searchFoods(query, options = {}) {
  if (!FDC_API_KEY) {
    throw new Error('FDC_API_KEY is missing');
  }

  const sanitizedQuery = sanitizeSearchQuery(query);
  if (!sanitizedQuery) {
    console.warn(`[fdc] Skipping FDC search for empty/unsafe query: "${query}"`);
    return [];
  }

  const {
    dataTypes = ['Foundation', 'SR Legacy'],
    pageSize = 25, // Get more results for better matching
  } = options;

  const attempts = [sanitizedQuery];
  const fallback = simplifyQueryForRetry(sanitizedQuery);
  if (fallback && fallback !== sanitizedQuery) {
    attempts.push(fallback);
  }

  let lastError = null;

  for (const attempt of attempts) {
    const cacheKey = `search:${attempt.toLowerCase()}:${dataTypes.join(',')}:${pageSize}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    // Build URL with query parameters (GET is more reliable than POST for this API)
    const params = new URLSearchParams({
      api_key: FDC_API_KEY,
      query: attempt,
      pageSize: String(pageSize),
    });

    // Add data types as multiple parameters
    for (const dt of dataTypes) {
      params.append('dataType', dt);
    }

    try {
      const data = await fetchJson(`${FDC_BASE_URL}/foods/search?${params.toString()}`);
      const foods = (data.foods || []).map(normalizeSearchResult);
      setCache(cacheKey, foods);
      return foods;
    } catch (err) {
      lastError = err;
      console.warn(`[fdc] Search failed for "${attempt}":`, err.message);
    }
  }

  throw lastError || new Error('FDC search failed');
}

/**
 * Search with multiple queries and return best match
 * @param {Array<string>} queries - Array of search queries to try
 * @param {Object} options - Search options
 * @returns {Object|null} Best matching food or null
 */
export async function searchBestMatch(queries, options = {}) {
  if (!queries || !queries.length) return null;

  const allResults = [];

  // Search with each query
  for (const query of queries) {
    if (!query || !query.trim()) continue;

    try {
      const results = await searchFoods(query.trim(), {
        ...options,
        pageSize: 5,
      });

      // Score each result
      for (const food of results) {
        const score = calculateMatchScore(food, queries[0], query);
        allResults.push({ ...food, matchScore: score, matchedQuery: query });
      }
    } catch (err) {
      console.warn(`[fdc] Search failed for "${query}":`, err.message);
    }
  }

  if (!allResults.length) return null;

  // Sort by score and return best match
  allResults.sort((a, b) => b.matchScore - a.matchScore);
  return allResults[0];
}

/**
 * Get detailed food information including portions
 * @param {number} fdcId - FDC ID of the food
 * @returns {Object} Detailed food data
 */
export async function getFoodDetails(fdcId) {
  if (!FDC_API_KEY) {
    throw new Error('FDC_API_KEY is missing');
  }

  const cacheKey = `food:${fdcId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(
    `${FDC_BASE_URL}/food/${fdcId}?api_key=${FDC_API_KEY}`
  );

  const normalized = normalizeFullFood(data);
  setCache(cacheKey, normalized);

  return normalized;
}

/**
 * Get multiple foods by ID
 * @param {Array<number>} fdcIds - Array of FDC IDs
 * @returns {Array} Array of food data
 */
export async function getFoodsById(fdcIds) {
  if (!FDC_API_KEY) {
    throw new Error('FDC_API_KEY is missing');
  }

  if (!fdcIds || !fdcIds.length) return [];

  // Check cache first
  const cached = [];
  const uncached = [];

  for (const id of fdcIds) {
    const cacheKey = `food:${id}`;
    const entry = getFromCache(cacheKey);
    if (entry) {
      cached.push(entry);
    } else {
      uncached.push(id);
    }
  }

  if (!uncached.length) return cached;

  // Fetch uncached foods
  const data = await postJson(
    `${FDC_BASE_URL}/foods?api_key=${FDC_API_KEY}`,
    { fdcIds: uncached }
  );

  const fetched = (data || []).map(food => {
    const normalized = normalizeFullFood(food);
    setCache(`food:${food.fdcId}`, normalized);
    return normalized;
  });

  return [...cached, ...fetched];
}

// ============================================
// Scoring functions
// ============================================

/**
 * Calculate match score for a food result
 * @param {Object} food - Food search result
 * @param {string} originalQuery - Original ingredient name
 * @param {string} searchQuery - Query used to find this result
 * @returns {number} Match score (0-100)
 */
function calculateMatchScore(food, originalQuery, searchQuery) {
  let score = 0;
  const description = (food.description || '').toLowerCase();
  const original = (originalQuery || '').toLowerCase();
  const search = (searchQuery || '').toLowerCase();

  // Get key words from queries (ignore common words)
  const ignoreWords = new Set(['raw', 'fresh', 'whole', 'with', 'and', 'or', 'the', 'a', 'an']);
  const getKeyWords = (str) => str.split(/[\s,]+/).filter(w => w.length >= 2 && !ignoreWords.has(w));

  const descWords = getKeyWords(description);
  const searchWords = getKeyWords(search);
  const originalWords = getKeyWords(original);

  // Get the primary ingredient word (the most important one)
  const primaryWord = searchWords[0] || originalWords[0];
  const descFirstWord = description.split(/[\s,]/)[0].toLowerCase();

  // CRITICAL: For multi-word ingredients, ALL key words should be present
  // This prevents "olive oil" matching "Olive loaf" (no "oil") or "Cherry juice" (no "tomato")
  if (searchWords.length >= 2) {
    // Check if ALL significant search words are in the description
    const allWordsPresent = searchWords.every(w => description.includes(w));
    const someWordsPresent = searchWords.some(w => description.includes(w));

    if (allWordsPresent) {
      score += 60; // Huge bonus when all words match
      // Extra bonus if they appear as a phrase
      if (description.includes(search)) {
        score += 20;
      }
    } else if (someWordsPresent) {
      // Only some words present - penalize based on missing words
      const missingWords = searchWords.filter(w => !description.includes(w));
      score -= missingWords.length * 25; // Heavy penalty for missing key words
    } else {
      score -= 50; // No search words found at all
    }
  } else if (primaryWord) {
    // Single word search - check position
    const descStartsWithWord = description.startsWith(primaryWord);
    const wordInDesc = description.includes(primaryWord);

    if (descStartsWithWord) {
      score += 50; // Huge bonus for matching start
    } else if (wordInDesc) {
      score += 20; // Moderate bonus for containing the word
    } else {
      score -= 40; // Primary word not found at all
    }
  }

  // Exact match bonus (huge bonus)
  if (description === search) {
    score += 80;
  } else if (description === original) {
    score += 70;
  }

  // Contains the search query as a consecutive phrase
  if (search && description.includes(search)) {
    score += 35;
  } else if (original && description.includes(original)) {
    score += 30;
  }

  // Word overlap scoring - ALL search words should be present
  let matchedWords = 0;
  let totalSearchWords = searchWords.length;
  for (const word of searchWords) {
    if (word.length >= 2 && description.includes(word)) {
      matchedWords++;
    }
  }

  if (totalSearchWords > 0) {
    const matchRatio = matchedWords / totalSearchWords;
    if (matchRatio === 1) {
      score += 30; // All words matched
    } else if (matchRatio >= 0.5) {
      score += 15; // Most words matched
    } else {
      score -= 10; // Few words matched
    }
  }

  // Penalize if description has many extra words (prefer simple/pure ingredients)
  const extraWords = descWords.length - searchWords.length;
  if (extraWords > 4) {
    score -= Math.min((extraWords - 2) * 3, 20);
  }

  // Penalize mixed/compound foods unless query suggests it
  const compoundIndicators = [' with ', ' and ', ' in ', 'mixture', 'blend', 'loaf', 'roll'];
  for (const term of compoundIndicators) {
    if (description.includes(term) && !search.includes(term.trim()) && !original.includes(term.trim())) {
      score -= 15;
    }
  }

  // Data type priority (Foundation is most accurate)
  const typePriority = DATA_TYPE_PRIORITY[food.dataType] || 0;
  score += typePriority * 4;

  // Prefer raw/uncooked for better accuracy (USDA raw data is base)
  if (description.includes('raw')) {
    if (search.includes('raw') || original.includes('raw')) {
      score += 12;
    } else if (!search.includes('cooked') && !original.includes('cooked')) {
      score += 6;
    }
  }

  // Penalize processed/prepared foods unless specifically requested
  const processedTerms = ['fast food', 'restaurant', 'frozen', 'prepared', 'commercial', 'breaded', 'fried'];
  for (const term of processedTerms) {
    if (description.includes(term) && !search.includes(term) && !original.includes(term)) {
      score -= 15;
    }
  }

  // Penalize branded/specific products for generic queries
  if (food.brandOwner || food.brandName) {
    if (!search.includes(food.brandName?.toLowerCase() || '')) {
      score -= 10;
    }
  }

  // Nutrient completeness bonus - CRITICAL: must have calories
  if (food.nutrients) {
    const nutrientCount = Object.keys(food.nutrients).length;
    score += Math.min(nutrientCount, 6);

    // Heavily penalize if missing critical nutrients (calories, protein, etc.)
    if (!food.nutrients.calories || food.nutrients.calories === 0) {
      // Only penalize for foods that should have calories (not seasonings)
      const likelyHasCalories = !description.includes('salt') &&
                                !description.includes('spice') &&
                                !description.includes('water');
      if (likelyHasCalories) {
        score -= 30; // Heavy penalty for missing calories
      }
    }
  } else {
    score -= 20; // Penalty for no nutrient data at all
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate text similarity using Jaro-Winkler-like approach
 */
function textSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Simple word overlap
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  let overlap = 0;
  for (const w of words1) {
    if (words2.has(w)) overlap++;
  }

  return overlap / Math.max(words1.size, words2.size);
}

// ============================================
// Normalization functions
// ============================================

/**
 * Normalize a search result
 */
function normalizeSearchResult(food) {
  return {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    brandOwner: food.brandOwner || null,
    brandName: food.brandName || null,
    ingredients: food.ingredients || null,
    servingSize: food.servingSize || null,
    servingSizeUnit: food.servingSizeUnit || null,
    nutrients: extractNutrientsFromSearch(food.foodNutrients || []),
  };
}

/**
 * Normalize full food details
 */
function normalizeFullFood(food) {
  const portions = extractPortions(food.foodPortions || []);
  const nutrients = extractNutrientsFromDetails(food.foodNutrients || []);

  return {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    brandOwner: food.brandOwner || null,
    brandName: food.brandName || null,
    ingredients: food.ingredients || null,
    category: food.foodCategory?.description || null,
    nutrients,
    portions,
    // Serving info (for branded foods)
    servingSize: food.servingSize || null,
    servingSizeUnit: food.servingSizeUnit || null,
    householdServingFullText: food.householdServingFullText || null,
  };
}

/**
 * Extract nutrients from search results (different format than details)
 */
function extractNutrientsFromSearch(foodNutrients) {
  const nutrients = {};

  for (const [key, id] of Object.entries(NUTRIENT_IDS)) {
    // Try by ID first
    let match = foodNutrients.find(n => n.nutrientId === id);

    // Fall back to name matching
    if (!match) {
      const names = NUTRIENT_NAMES[key] || [];
      match = foodNutrients.find(n =>
        names.some(name =>
          (n.nutrientName || '').toLowerCase() === name.toLowerCase()
        )
      );
    }

    if (match && typeof match.value === 'number') {
      nutrients[key] = match.value;
    }
  }

  return nutrients;
}

/**
 * Extract nutrients from full food details
 */
function extractNutrientsFromDetails(foodNutrients) {
  const nutrients = {};

  for (const [key, id] of Object.entries(NUTRIENT_IDS)) {
    // Try by ID first
    let match = foodNutrients.find(n =>
      n.nutrient?.id === id || n.nutrientId === id
    );

    // Fall back to name matching
    if (!match) {
      const names = NUTRIENT_NAMES[key] || [];
      match = foodNutrients.find(n => {
        const nutrientName = n.nutrient?.name || n.nutrientName || '';
        return names.some(name =>
          nutrientName.toLowerCase() === name.toLowerCase()
        );
      });
    }

    if (match) {
      const value = match.amount ?? match.value;
      if (typeof value === 'number') {
        nutrients[key] = value;
      }
    }
  }

  return nutrients;
}

/**
 * Extract portion data with gram weights
 */
function extractPortions(foodPortions) {
  if (!foodPortions || !foodPortions.length) return [];

  return foodPortions
    .filter(p => p.gramWeight && p.gramWeight > 0)
    .map(p => ({
      id: p.id,
      description: p.portionDescription || p.measureUnit?.name || 'serving',
      amount: p.amount || 1,
      gramWeight: p.gramWeight,
      modifier: p.modifier || null,
      // Calculated: grams per single unit
      gramsPerUnit: p.gramWeight / (p.amount || 1),
    }))
    .sort((a, b) => {
      // Prioritize common units
      const priority = ['cup', 'tbsp', 'tsp', 'oz', 'slice', 'piece'];
      const aDesc = (a.description || '').toLowerCase();
      const bDesc = (b.description || '').toLowerCase();

      for (const term of priority) {
        const aHas = aDesc.includes(term);
        const bHas = bDesc.includes(term);
        if (aHas && !bHas) return -1;
        if (bHas && !aHas) return 1;
      }

      return 0;
    });
}

// ============================================
// High-level search function
// ============================================

/**
 * Search for a food and return comprehensive data
 * This is the main function to use for macro calculations
 *
 * @param {string} ingredientName - The ingredient name
 * @param {Array<string>} searchQueries - Alternative search queries
 * @param {Object} options - Options
 * @returns {Object|null} Food data with nutrients and portions
 */
export async function findFood(ingredientName, searchQueries = [], options = {}) {
  if (!FDC_API_KEY) {
    throw new Error('FDC_API_KEY is missing');
  }

  // Build search queries
  const queries = searchQueries.length > 0
    ? searchQueries
    : [ingredientName];

  // Add original name if not in queries
  if (!queries.includes(ingredientName)) {
    queries.unshift(ingredientName);
  }

  // Search for best match
  const bestMatch = await searchBestMatch(queries, {
    dataTypes: options.dataTypes || ['Foundation', 'SR Legacy'],
    ...options,
  });

  if (!bestMatch) {
    // Try with branded foods as fallback
    const brandedMatch = await searchBestMatch(queries, {
      dataTypes: ['Branded'],
      ...options,
    });

    if (!brandedMatch) return null;

    // Get full details for branded match
    let details;
    try {
      details = await getFoodDetails(brandedMatch.fdcId);
    } catch (err) {
      console.warn(`[fdc] Failed to load details for branded match ${brandedMatch.fdcId}:`, err.message);
      return {
        ...brandedMatch,
        portions: [],
        matchScore: brandedMatch.matchScore,
        matchedQuery: brandedMatch.matchedQuery,
        confidence: brandedMatch.matchScore >= 60 ? 'medium' : 'low',
      };
    }
    return {
      ...details,
      matchScore: brandedMatch.matchScore,
      matchedQuery: brandedMatch.matchedQuery,
      confidence: brandedMatch.matchScore >= 60 ? 'medium' : 'low',
    };
  }

  // Get full details including portions
  let details;
  try {
    details = await getFoodDetails(bestMatch.fdcId);
  } catch (err) {
    console.warn(`[fdc] Failed to load details for ${bestMatch.fdcId}:`, err.message);
    return {
      ...bestMatch,
      portions: [],
      matchScore: bestMatch.matchScore,
      matchedQuery: bestMatch.matchedQuery,
      confidence: bestMatch.matchScore >= 70 ? 'high' :
                  bestMatch.matchScore >= 50 ? 'medium' : 'low',
    };
  }

  return {
    ...details,
    matchScore: bestMatch.matchScore,
    matchedQuery: bestMatch.matchedQuery,
    confidence: bestMatch.matchScore >= 70 ? 'high' :
                bestMatch.matchScore >= 50 ? 'medium' : 'low',
  };
}

/**
 * Get portion weight in grams for a unit
 * @param {Object} food - Food with portions array
 * @param {string} unit - Unit to find (cup, tbsp, tsp, etc.)
 * @param {number} quantity - Amount
 * @returns {Object|null} { grams, confidence, source }
 */
export function getPortionGrams(food, unit, quantity = 1) {
  if (!food?.portions?.length || !unit) {
    return null;
  }

  const normalizedUnit = unit.toLowerCase().trim();

  // Map common unit variations
  const unitVariations = {
    'cup': ['cup', 'cups', 'c'],
    'tbsp': ['tbsp', 'tablespoon', 'tablespoons', 'tbs', 'tb'],
    'tsp': ['tsp', 'teaspoon', 'teaspoons'],
    'oz': ['oz', 'ounce', 'ounces'],
    'g': ['g', 'gram', 'grams'],
    'slice': ['slice', 'slices'],
    'piece': ['piece', 'pieces', 'pc', 'pcs'],
    'large': ['large', 'lg'],
    'medium': ['medium', 'med'],
    'small': ['small', 'sm'],
  };

  // Find which standard unit this matches
  let standardUnit = normalizedUnit;
  for (const [std, variations] of Object.entries(unitVariations)) {
    if (variations.includes(normalizedUnit)) {
      standardUnit = std;
      break;
    }
  }

  // Search portions for matching unit
  for (const portion of food.portions) {
    const desc = (portion.description || '').toLowerCase();

    // Check for unit in description
    const variations = unitVariations[standardUnit] || [standardUnit];
    for (const variation of variations) {
      if (desc.includes(variation)) {
        return {
          grams: quantity * portion.gramsPerUnit,
          confidence: 'high',
          source: 'usda_portion',
          portionDescription: portion.description,
        };
      }
    }
  }

  return null;
}

// ============================================
// Utility exports
// ============================================

export function hasFdcKey() {
  return Boolean(FDC_API_KEY);
}

export function clearCache() {
  cache.clear();
}

export { NUTRIENT_IDS, NUTRIENT_NAMES, DATA_TYPE_PRIORITY };
