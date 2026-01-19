/**
 * Yield Factors for Cooked vs Raw Adjustments
 *
 * When recipes specify raw ingredients but the final dish is cooked,
 * or vice versa, yield factors adjust the weight and nutrient density.
 *
 * Yield factor = cooked weight / raw weight
 * - Factor < 1: Food loses weight (water loss) - meats, vegetables
 * - Factor > 1: Food gains weight (water absorption) - grains, pasta
 *
 * Nutrient retention factors account for nutrient loss during cooking.
 */

// Yield factors: raw to cooked weight ratios
export const YIELD_FACTORS = {
  // ============================================
  // PROTEINS - Generally lose water when cooked
  // ============================================
  proteins: {
    // Chicken
    'chicken breast': {
      baked: 0.75,
      grilled: 0.73,
      fried: 0.70,
      poached: 0.78,
      boiled: 0.80,
      default: 0.75,
    },
    'chicken thigh': {
      baked: 0.72,
      grilled: 0.70,
      fried: 0.68,
      default: 0.72,
    },
    'chicken drumstick': {
      baked: 0.75,
      grilled: 0.73,
      default: 0.75,
    },
    'chicken wing': {
      baked: 0.70,
      fried: 0.65,
      default: 0.70,
    },
    'chicken whole': {
      roasted: 0.72,
      default: 0.72,
    },

    // Beef
    'beef ground': {
      pan_fried: 0.71,
      grilled: 0.70,
      baked: 0.73,
      default: 0.71,
    },
    'beef steak': {
      rare: 0.88,
      medium_rare: 0.85,
      medium: 0.80,
      well_done: 0.72,
      default: 0.80,
    },
    'beef roast': {
      roasted: 0.75,
      braised: 0.70,
      default: 0.75,
    },
    'beef brisket': {
      smoked: 0.55,
      braised: 0.65,
      default: 0.60,
    },

    // Pork
    'pork chop': {
      grilled: 0.75,
      pan_fried: 0.73,
      baked: 0.77,
      default: 0.75,
    },
    'pork tenderloin': {
      roasted: 0.75,
      grilled: 0.73,
      default: 0.75,
    },
    'pork shoulder': {
      slow_cooked: 0.60,
      braised: 0.65,
      default: 0.62,
    },
    'bacon': {
      pan_fried: 0.30,
      baked: 0.35,
      microwaved: 0.32,
      default: 0.30,
    },
    'sausage': {
      pan_fried: 0.75,
      grilled: 0.73,
      default: 0.75,
    },

    // Turkey
    'turkey breast': {
      roasted: 0.75,
      grilled: 0.73,
      default: 0.75,
    },
    'turkey ground': {
      pan_fried: 0.72,
      default: 0.72,
    },

    // Fish
    'salmon': {
      baked: 0.80,
      grilled: 0.78,
      poached: 0.85,
      pan_seared: 0.77,
      default: 0.80,
    },
    'tuna': {
      seared: 0.85,
      baked: 0.78,
      canned: 1.0, // Already cooked
      default: 0.80,
    },
    'tilapia': {
      baked: 0.80,
      pan_fried: 0.77,
      default: 0.80,
    },
    'cod': {
      baked: 0.82,
      poached: 0.85,
      default: 0.82,
    },
    'halibut': {
      baked: 0.80,
      grilled: 0.78,
      default: 0.80,
    },
    'shrimp': {
      boiled: 0.77,
      sauteed: 0.75,
      grilled: 0.73,
      default: 0.75,
    },
    'scallops': {
      seared: 0.75,
      default: 0.75,
    },

    // Other proteins
    'tofu': {
      pan_fried: 0.85,
      baked: 0.80,
      pressed_fried: 0.70,
      default: 0.85,
    },
    'tempeh': {
      pan_fried: 0.90,
      baked: 0.88,
      default: 0.90,
    },
    'egg': {
      scrambled: 0.90,
      fried: 0.88,
      boiled: 0.95,
      poached: 0.95,
      default: 0.92,
    },
  },

  // ============================================
  // GRAINS & STARCHES - Generally absorb water
  // ============================================
  grains: {
    'rice white': {
      boiled: 3.0,
      steamed: 2.8,
      default: 3.0,
    },
    'rice brown': {
      boiled: 2.5,
      default: 2.5,
    },
    'rice basmati': {
      boiled: 3.0,
      default: 3.0,
    },
    'rice jasmine': {
      boiled: 2.8,
      default: 2.8,
    },
    'pasta': {
      boiled: 2.25,
      default: 2.25,
    },
    'spaghetti': {
      boiled: 2.25,
      default: 2.25,
    },
    'penne': {
      boiled: 2.1,
      default: 2.1,
    },
    'macaroni': {
      boiled: 2.0,
      default: 2.0,
    },
    'noodles egg': {
      boiled: 2.0,
      default: 2.0,
    },
    'quinoa': {
      boiled: 3.0,
      default: 3.0,
    },
    'couscous': {
      steamed: 2.5,
      default: 2.5,
    },
    'oatmeal': {
      cooked: 4.0,
      default: 4.0,
    },
    'oats': {
      cooked: 4.0,
      default: 4.0,
    },
    'barley': {
      boiled: 3.5,
      default: 3.5,
    },
    'bulgur': {
      soaked: 2.5,
      default: 2.5,
    },
    'farro': {
      boiled: 2.5,
      default: 2.5,
    },
    'polenta': {
      cooked: 4.0,
      default: 4.0,
    },
  },

  // ============================================
  // LEGUMES - Absorb water when cooked
  // ============================================
  legumes: {
    'beans black': {
      boiled: 2.3,
      default: 2.3,
    },
    'beans kidney': {
      boiled: 2.2,
      default: 2.2,
    },
    'beans pinto': {
      boiled: 2.3,
      default: 2.3,
    },
    'beans white': {
      boiled: 2.2,
      default: 2.2,
    },
    'chickpeas': {
      boiled: 2.0,
      default: 2.0,
    },
    'lentils': {
      boiled: 2.5,
      default: 2.5,
    },
    'split peas': {
      boiled: 2.4,
      default: 2.4,
    },
  },

  // ============================================
  // VEGETABLES - Mostly lose water when cooked
  // ============================================
  vegetables: {
    'spinach': {
      sauteed: 0.23,
      steamed: 0.25,
      boiled: 0.20,
      default: 0.23,
    },
    'kale': {
      sauteed: 0.35,
      steamed: 0.40,
      default: 0.35,
    },
    'broccoli': {
      steamed: 0.90,
      boiled: 0.88,
      roasted: 0.80,
      default: 0.90,
    },
    'cauliflower': {
      steamed: 0.92,
      roasted: 0.78,
      default: 0.90,
    },
    'carrots': {
      boiled: 0.90,
      roasted: 0.75,
      steamed: 0.92,
      default: 0.90,
    },
    'onions': {
      sauteed: 0.65,
      caramelized: 0.40,
      roasted: 0.60,
      default: 0.65,
    },
    'mushrooms': {
      sauteed: 0.50,
      roasted: 0.55,
      default: 0.50,
    },
    'zucchini': {
      sauteed: 0.85,
      grilled: 0.80,
      roasted: 0.75,
      default: 0.85,
    },
    'bell peppers': {
      sauteed: 0.85,
      roasted: 0.70,
      grilled: 0.75,
      default: 0.80,
    },
    'tomatoes': {
      roasted: 0.70,
      sauteed: 0.80,
      default: 0.75,
    },
    'asparagus': {
      grilled: 0.85,
      roasted: 0.80,
      steamed: 0.92,
      default: 0.85,
    },
    'green beans': {
      steamed: 0.90,
      boiled: 0.88,
      sauteed: 0.85,
      default: 0.90,
    },
    'cabbage': {
      sauteed: 0.70,
      steamed: 0.85,
      default: 0.75,
    },
    'brussels sprouts': {
      roasted: 0.75,
      steamed: 0.90,
      default: 0.80,
    },
    'potatoes': {
      boiled: 0.95,
      baked: 0.90,
      roasted: 0.85,
      mashed: 1.1, // Water/milk added
      fried: 0.65,
      default: 0.90,
    },
    'sweet potatoes': {
      baked: 0.88,
      boiled: 0.95,
      roasted: 0.82,
      default: 0.88,
    },
    'corn': {
      boiled: 0.95,
      grilled: 0.90,
      default: 0.95,
    },
    'eggplant': {
      grilled: 0.70,
      roasted: 0.65,
      sauteed: 0.75,
      default: 0.70,
    },
  },
};

// Nutrient retention factors by cooking method (percentage retained)
export const NUTRIENT_RETENTION = {
  // Vitamins are most affected by cooking
  vitamins: {
    boiled: {
      vitamin_c: 0.50,
      vitamin_b1: 0.70,
      vitamin_b2: 0.80,
      vitamin_b6: 0.70,
      folate: 0.50,
      vitamin_a: 0.90,
    },
    steamed: {
      vitamin_c: 0.70,
      vitamin_b1: 0.85,
      vitamin_b2: 0.90,
      vitamin_b6: 0.85,
      folate: 0.75,
      vitamin_a: 0.95,
    },
    microwaved: {
      vitamin_c: 0.80,
      vitamin_b1: 0.90,
      vitamin_b2: 0.95,
      vitamin_b6: 0.90,
      folate: 0.85,
      vitamin_a: 0.98,
    },
    sauteed: {
      vitamin_c: 0.65,
      vitamin_b1: 0.80,
      vitamin_b2: 0.85,
      vitamin_b6: 0.80,
      folate: 0.70,
      vitamin_a: 0.95,
    },
    roasted: {
      vitamin_c: 0.55,
      vitamin_b1: 0.75,
      vitamin_b2: 0.85,
      vitamin_b6: 0.75,
      folate: 0.60,
      vitamin_a: 0.90,
    },
    grilled: {
      vitamin_c: 0.50,
      vitamin_b1: 0.75,
      vitamin_b2: 0.85,
      vitamin_b6: 0.75,
      folate: 0.55,
      vitamin_a: 0.90,
    },
    fried: {
      vitamin_c: 0.45,
      vitamin_b1: 0.70,
      vitamin_b2: 0.80,
      vitamin_b6: 0.70,
      folate: 0.50,
      vitamin_a: 0.85,
    },
    raw: {
      vitamin_c: 1.0,
      vitamin_b1: 1.0,
      vitamin_b2: 1.0,
      vitamin_b6: 1.0,
      folate: 1.0,
      vitamin_a: 1.0,
    },
  },
  // Macros are largely retained (some fat loss in cooking)
  macros: {
    boiled: { protein: 0.98, fat: 0.95, carbs: 0.98 },
    steamed: { protein: 0.99, fat: 0.98, carbs: 0.99 },
    sauteed: { protein: 0.98, fat: 1.0, carbs: 0.98 }, // Fat may increase due to cooking oil
    roasted: { protein: 0.97, fat: 0.90, carbs: 0.97 },
    grilled: { protein: 0.97, fat: 0.85, carbs: 0.97 },
    fried: { protein: 0.96, fat: 1.15, carbs: 0.96 }, // Fat increases due to absorption
    raw: { protein: 1.0, fat: 1.0, carbs: 1.0 },
  },
};

/**
 * Get yield factor for converting between raw and cooked weight
 * @param {string} ingredientName - The ingredient name
 * @param {string} cookingMethod - Optional specific cooking method
 * @param {string} direction - 'raw_to_cooked' or 'cooked_to_raw'
 * @returns {Object} { factor, confidence, category }
 */
export function getYieldFactor(ingredientName, cookingMethod = null, direction = 'raw_to_cooked') {
  const nameLower = (ingredientName || '').toLowerCase().trim();
  const methodLower = (cookingMethod || '').toLowerCase().trim();

  // Search through categories
  for (const [category, items] of Object.entries(YIELD_FACTORS)) {
    for (const [itemName, methods] of Object.entries(items)) {
      if (nameLower.includes(itemName) || itemName.includes(nameLower)) {
        let factor;
        let usedMethod;

        if (methodLower && methods[methodLower]) {
          factor = methods[methodLower];
          usedMethod = methodLower;
        } else {
          factor = methods.default;
          usedMethod = 'default';
        }

        // Invert factor if converting cooked to raw
        if (direction === 'cooked_to_raw') {
          factor = 1 / factor;
        }

        return {
          factor,
          confidence: usedMethod === methodLower ? 'high' : 'medium',
          category,
          ingredient: itemName,
          method: usedMethod,
        };
      }
    }
  }

  // No match found - return no adjustment
  return {
    factor: 1.0,
    confidence: 'low',
    category: 'unknown',
    ingredient: ingredientName,
    method: 'none',
    note: 'No yield factor found, using 1:1 ratio',
  };
}

/**
 * Calculate cooked weight from raw weight
 * @param {number} rawGrams - Weight in grams (raw)
 * @param {string} ingredientName - Ingredient name
 * @param {string} cookingMethod - Cooking method
 * @returns {Object} { cookedGrams, factor, note }
 */
export function rawToCooked(rawGrams, ingredientName, cookingMethod = null) {
  if (!rawGrams || !Number.isFinite(rawGrams) || rawGrams <= 0) {
    return { cookedGrams: null, error: 'Invalid raw weight' };
  }

  const yieldData = getYieldFactor(ingredientName, cookingMethod, 'raw_to_cooked');

  return {
    cookedGrams: rawGrams * yieldData.factor,
    factor: yieldData.factor,
    confidence: yieldData.confidence,
    note: yieldData.note || `${ingredientName} ${yieldData.method}: ${rawGrams}g raw → ${(rawGrams * yieldData.factor).toFixed(1)}g cooked`,
  };
}

/**
 * Calculate raw weight from cooked weight
 * @param {number} cookedGrams - Weight in grams (cooked)
 * @param {string} ingredientName - Ingredient name
 * @param {string} cookingMethod - Cooking method
 * @returns {Object} { rawGrams, factor, note }
 */
export function cookedToRaw(cookedGrams, ingredientName, cookingMethod = null) {
  if (!cookedGrams || !Number.isFinite(cookedGrams) || cookedGrams <= 0) {
    return { rawGrams: null, error: 'Invalid cooked weight' };
  }

  const yieldData = getYieldFactor(ingredientName, cookingMethod, 'cooked_to_raw');

  return {
    rawGrams: cookedGrams * yieldData.factor,
    factor: yieldData.factor,
    confidence: yieldData.confidence,
    note: yieldData.note || `${ingredientName} ${yieldData.method}: ${cookedGrams}g cooked → ${(cookedGrams * yieldData.factor).toFixed(1)}g raw`,
  };
}

/**
 * Adjust macros for cooking method
 * This is useful when USDA data is for raw but recipe produces cooked food
 * @param {Object} macros - { calories, protein, carbs, fat }
 * @param {number} rawGrams - Original raw weight
 * @param {string} ingredientName - Ingredient name
 * @param {string} cookingMethod - Cooking method
 * @returns {Object} Adjusted macros with yield-adjusted values
 */
export function adjustMacrosForCooking(macros, rawGrams, ingredientName, cookingMethod = null) {
  const yieldData = getYieldFactor(ingredientName, cookingMethod, 'raw_to_cooked');

  // For items that lose weight (factor < 1), nutrients concentrate
  // For items that gain weight (factor > 1), nutrients dilute
  // But total nutrients remain similar (with some retention loss)

  const method = (cookingMethod || 'default').toLowerCase();
  const retention = NUTRIENT_RETENTION.macros[method] || NUTRIENT_RETENTION.macros.raw;

  const cookedGrams = rawGrams * yieldData.factor;

  // Total nutrients based on raw amount (USDA data is per 100g raw)
  // Apply retention factors for cooking losses
  const totalNutrients = {
    calories: (macros.calories || 0) * retention.protein, // Approximate
    protein: (macros.protein || 0) * retention.protein,
    carbs: (macros.carbs || 0) * retention.carbs,
    fat: (macros.fat || 0) * retention.fat,
  };

  return {
    rawGrams,
    cookedGrams,
    yieldFactor: yieldData.factor,
    // Per 100g cooked (for display purposes)
    per100gCooked: {
      calories: totalNutrients.calories * (100 / cookedGrams),
      protein: totalNutrients.protein * (100 / cookedGrams),
      carbs: totalNutrients.carbs * (100 / cookedGrams),
      fat: totalNutrients.fat * (100 / cookedGrams),
    },
    // Total for the amount specified
    total: totalNutrients,
    confidence: yieldData.confidence,
    method: yieldData.method,
  };
}

/**
 * Detect cooking method from ingredient text or recipe context
 * @param {string} text - Text to analyze
 * @returns {string|null} Detected cooking method
 */
export function detectCookingMethod(text) {
  if (!text) return null;

  const lower = text.toLowerCase();

  const methodPatterns = [
    { pattern: /\b(baked?|baking)\b/, method: 'baked' },
    { pattern: /\b(roasted?|roasting)\b/, method: 'roasted' },
    { pattern: /\b(grilled?|grilling)\b/, method: 'grilled' },
    { pattern: /\b(fried|frying|pan[- ]?fried)\b/, method: 'pan_fried' },
    { pattern: /\b(deep[- ]?fried)\b/, method: 'fried' },
    { pattern: /\b(sauteed?|sautéed?|sauteing)\b/, method: 'sauteed' },
    { pattern: /\b(boiled?|boiling)\b/, method: 'boiled' },
    { pattern: /\b(steamed?|steaming)\b/, method: 'steamed' },
    { pattern: /\b(poached?|poaching)\b/, method: 'poached' },
    { pattern: /\b(braised?|braising)\b/, method: 'braised' },
    { pattern: /\b(smoked?|smoking)\b/, method: 'smoked' },
    { pattern: /\b(slow[- ]?cooked?|slow[- ]?cooking)\b/, method: 'slow_cooked' },
    { pattern: /\b(microwaved?)\b/, method: 'microwaved' },
    { pattern: /\b(seared?|searing)\b/, method: 'seared' },
    { pattern: /\b(caramelized?)\b/, method: 'caramelized' },
    { pattern: /\b(raw|uncooked|fresh)\b/, method: 'raw' },
  ];

  for (const { pattern, method } of methodPatterns) {
    if (pattern.test(lower)) {
      return method;
    }
  }

  return null;
}

/**
 * Determine if an ingredient is likely cooked in the final dish
 * @param {string} ingredientText - Original ingredient text
 * @param {Array<string>} recipeSteps - Recipe instruction steps
 * @returns {Object} { isCooked, method, confidence }
 */
export function analyzeIngredientCookingState(ingredientText, recipeSteps = []) {
  // Check ingredient text first
  const ingredientMethod = detectCookingMethod(ingredientText);
  if (ingredientMethod === 'raw') {
    return { isCooked: false, method: 'raw', confidence: 'high' };
  }
  if (ingredientMethod) {
    return { isCooked: true, method: ingredientMethod, confidence: 'high' };
  }

  // Check recipe steps for cooking references
  const allSteps = recipeSteps.join(' ').toLowerCase();
  const stepsMethod = detectCookingMethod(allSteps);

  if (stepsMethod && stepsMethod !== 'raw') {
    return { isCooked: true, method: stepsMethod, confidence: 'medium' };
  }

  // Default: assume ingredients get cooked if not specified
  const rawIndicators = ['salad', 'garnish', 'topping', 'serving', 'dressing'];
  const lower = ingredientText.toLowerCase();

  for (const indicator of rawIndicators) {
    if (lower.includes(indicator)) {
      return { isCooked: false, method: 'raw', confidence: 'medium' };
    }
  }

  // Default assumption: cooked
  return { isCooked: true, method: 'default', confidence: 'low' };
}
