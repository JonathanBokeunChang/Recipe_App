/**
 * Ingredient Normalizer
 * Extracts clean ingredient names and quantities from recipe text
 * for accurate USDA FDC matching.
 */

// Common cooking methods to strip
const COOKING_METHODS = [
  'baked', 'boiled', 'braised', 'broiled', 'charred', 'chopped', 'cooked',
  'crispy', 'crushed', 'cubed', 'diced', 'dried', 'fried', 'frozen',
  'grated', 'grilled', 'ground', 'julienned', 'marinated', 'mashed',
  'melted', 'minced', 'packed', 'peeled', 'poached', 'raw', 'roasted',
  'sauteed', 'sautéed', 'scrambled', 'shredded', 'sifted', 'sliced',
  'smoked', 'softened', 'steamed', 'stewed', 'thawed', 'toasted',
  'trimmed', 'warmed', 'whisked', 'zested',
];

// Descriptors that don't affect nutritional content significantly
const STRIP_DESCRIPTORS = [
  'fresh', 'freshly', 'organic', 'natural', 'pure', 'real', 'authentic',
  'homemade', 'store-bought', 'storebought', 'premium', 'quality',
  'good', 'best', 'fine', 'extra', 'large', 'medium', 'small',
  'thick', 'thin', 'cold', 'warm', 'hot', 'room temperature',
  'divided', 'optional', 'to taste', 'as needed', 'for serving',
  'for garnish', 'approximately', 'about', 'roughly', 'heaping',
  'scant', 'generous', 'level', 'packed', 'loosely packed',
];

// Brand indicators to remove
const BRAND_PATTERNS = [
  /\b(brand|®|™)\b/gi,
  /\([^)]*brand[^)]*\)/gi,
];

// Parenthetical info patterns (often contains non-nutritional info)
const PAREN_PATTERNS = [
  /\s*\([^)]*optional[^)]*\)/gi,
  /\s*\([^)]*divided[^)]*\)/gi,
  /\s*\([^)]*or more[^)]*\)/gi,
  /\s*\([^)]*to taste[^)]*\)/gi,
  /\s*\([^)]*for serving[^)]*\)/gi,
  /\s*\([^)]*garnish[^)]*\)/gi,
  /\s*\([^)]*such as[^)]*\)/gi,
];

// Quantity patterns for extraction
const QUANTITY_PATTERNS = [
  // Fractions: 1/2, 1/4, 3/4
  /^([\d]+\/[\d]+)\s*/,
  // Mixed numbers: 1 1/2, 2 3/4
  /^([\d]+\s+[\d]+\/[\d]+)\s*/,
  // Decimals: 1.5, 0.25
  /^([\d]+\.[\d]+)\s*/,
  // Whole numbers: 1, 2, 10
  /^([\d]+)\s*/,
  // Ranges: 1-2, 2-3
  /^([\d]+\s*-\s*[\d]+)\s*/,
];

// Unit patterns with standardization
const UNIT_MAP = {
  // Volume
  'cup': 'cup', 'cups': 'cup', 'c': 'cup', 'c.': 'cup',
  'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbsp': 'tbsp', 'tbsps': 'tbsp',
  'tbs': 'tbsp', 'tb': 'tbsp', 't': 'tbsp', 'tbl': 'tbsp',
  'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsp': 'tsp', 'tsps': 'tsp',
  'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'fl oz': 'fl oz', 'floz': 'fl oz',
  'milliliter': 'ml', 'milliliters': 'ml', 'ml': 'ml', 'mls': 'ml',
  'liter': 'l', 'liters': 'l', 'l': 'l', 'litre': 'l', 'litres': 'l',
  'pint': 'pint', 'pints': 'pint', 'pt': 'pint',
  'quart': 'quart', 'quarts': 'quart', 'qt': 'quart',
  'gallon': 'gallon', 'gallons': 'gallon', 'gal': 'gallon',

  // Weight
  'gram': 'g', 'grams': 'g', 'g': 'g', 'gm': 'g', 'gms': 'g',
  'kilogram': 'kg', 'kilograms': 'kg', 'kg': 'kg', 'kgs': 'kg',
  'milligram': 'mg', 'milligrams': 'mg', 'mg': 'mg',
  'ounce': 'oz', 'ounces': 'oz', 'oz': 'oz', 'ozs': 'oz',
  'pound': 'lb', 'pounds': 'lb', 'lb': 'lb', 'lbs': 'lb',

  // Count/pieces
  'piece': 'piece', 'pieces': 'piece', 'pc': 'piece', 'pcs': 'piece',
  'slice': 'slice', 'slices': 'slice',
  'clove': 'clove', 'cloves': 'clove',
  'head': 'head', 'heads': 'head',
  'bunch': 'bunch', 'bunches': 'bunch',
  'sprig': 'sprig', 'sprigs': 'sprig',
  'stalk': 'stalk', 'stalks': 'stalk',
  'stick': 'stick', 'sticks': 'stick',
  'can': 'can', 'cans': 'can',
  'jar': 'jar', 'jars': 'jar',
  'package': 'package', 'packages': 'package', 'pkg': 'package', 'pkgs': 'package',
  'container': 'container', 'containers': 'container',
  'whole': 'whole',
  'each': 'each',
  'ea': 'each',
};

// Common ingredient aliases for better USDA matching
const INGREDIENT_ALIASES = {
  // Proteins
  'chicken breast': 'chicken broiler breast meat raw',
  'chicken thigh': 'chicken broiler thigh meat raw',
  'chicken thighs': 'chicken broiler thigh meat raw',
  'ground beef': 'beef ground 85% lean raw',
  'ground turkey': 'turkey ground raw',
  'salmon fillet': 'salmon atlantic raw',
  'salmon': 'salmon atlantic raw',
  'shrimp': 'shrimp raw',
  'bacon': 'pork bacon raw',
  'sausage': 'pork sausage raw',
  'tofu': 'tofu firm raw',
  'egg': 'egg whole raw',
  'eggs': 'egg whole raw',

  // Dairy
  'butter': 'butter salted',
  'unsalted butter': 'butter unsalted',
  'milk': 'milk whole',
  'whole milk': 'milk whole',
  'skim milk': 'milk nonfat',
  '2% milk': 'milk reduced fat 2%',
  'heavy cream': 'cream heavy whipping',
  'cream cheese': 'cream cheese',
  'sour cream': 'sour cream',
  'greek yogurt': 'yogurt greek plain nonfat',
  'yogurt': 'yogurt plain whole milk',
  'cheddar': 'cheese cheddar',
  'cheddar cheese': 'cheese cheddar',
  'parmesan': 'cheese parmesan hard',
  'parmesan cheese': 'cheese parmesan hard',
  'mozzarella': 'cheese mozzarella whole milk',
  'mozzarella cheese': 'cheese mozzarella whole milk',

  // Oils & Fats
  'olive oil': 'oil olive',
  'extra virgin olive oil': 'oil olive extra virgin',
  'vegetable oil': 'oil vegetable',
  'canola oil': 'oil canola',
  'coconut oil': 'oil coconut',
  'sesame oil': 'oil sesame',
  'avocado oil': 'oil avocado',

  // Grains & Starches
  'white rice': 'rice white long grain raw',
  'brown rice': 'rice brown long grain raw',
  'pasta': 'pasta dry',
  'spaghetti': 'spaghetti dry',
  'penne': 'pasta dry',
  'bread': 'bread white',
  'white bread': 'bread white',
  'whole wheat bread': 'bread whole wheat',
  'flour': 'flour all purpose',
  'all purpose flour': 'flour all purpose',
  'all-purpose flour': 'flour all purpose',
  'bread flour': 'flour bread',
  'whole wheat flour': 'flour whole wheat',
  'oats': 'oats regular',
  'rolled oats': 'oats regular',
  'quinoa': 'quinoa uncooked',

  // Vegetables
  'onion': 'onions raw',
  'onions': 'onions raw',
  'garlic': 'garlic raw',
  'garlic cloves': 'garlic raw',
  'tomato': 'tomatoes red ripe raw',
  'tomatoes': 'tomatoes red ripe raw',
  'cherry tomatoes': 'tomatoes grape raw',
  'grape tomatoes': 'tomatoes grape raw',
  'potato': 'potatoes raw',
  'potatoes': 'potatoes raw',
  'sweet potato': 'sweet potato raw',
  'sweet potatoes': 'sweet potato raw',
  'carrot': 'carrots raw',
  'carrots': 'carrots raw',
  'celery': 'celery raw',
  'bell pepper': 'peppers sweet raw',
  'bell peppers': 'peppers sweet raw',
  'red bell pepper': 'peppers sweet red raw',
  'green bell pepper': 'peppers sweet green raw',
  'broccoli': 'broccoli raw',
  'spinach': 'spinach raw',
  'kale': 'kale raw',
  'lettuce': 'lettuce iceberg raw',
  'romaine': 'lettuce romaine raw',
  'romaine lettuce': 'lettuce romaine raw',
  'mushrooms': 'mushrooms white raw',
  'mushroom': 'mushrooms white raw',
  'zucchini': 'squash zucchini raw',
  'cucumber': 'cucumber with peel raw',
  'avocado': 'avocados raw',
  'corn': 'corn sweet yellow raw',
  'green beans': 'beans green raw',
  'asparagus': 'asparagus raw',
  'cauliflower': 'cauliflower raw',
  'cabbage': 'cabbage raw',

  // Fruits
  'apple': 'apples raw with skin',
  'apples': 'apples raw with skin',
  'banana': 'bananas raw',
  'bananas': 'bananas raw',
  'lemon': 'lemons raw',
  'lemon juice': 'lemon juice raw',
  'lime': 'limes raw',
  'lime juice': 'lime juice raw',
  'orange': 'oranges raw',
  'strawberries': 'strawberries raw',
  'blueberries': 'blueberries raw',

  // Legumes & Nuts
  'black beans': 'beans black canned drained',
  'kidney beans': 'beans kidney canned drained',
  'chickpeas': 'chickpeas canned drained',
  'lentils': 'lentils raw',
  'peanut butter': 'peanut butter smooth',
  'almond butter': 'almond butter',
  'almonds': 'nuts almonds',
  'walnuts': 'nuts walnuts',
  'cashews': 'nuts cashews raw',
  'peanuts': 'peanuts raw',

  // Sweeteners
  'sugar': 'sugar granulated',
  'white sugar': 'sugar granulated',
  'brown sugar': 'sugar brown',
  'honey': 'honey',
  'maple syrup': 'syrups maple',
  'powdered sugar': 'sugar powdered',

  // Condiments & Sauces
  'soy sauce': 'soy sauce',
  'worcestershire': 'worcestershire sauce',
  'worcestershire sauce': 'worcestershire sauce',
  'ketchup': 'ketchup',
  'mustard': 'mustard prepared yellow',
  'mayonnaise': 'mayonnaise',
  'mayo': 'mayonnaise',
  'hot sauce': 'sauce hot chile pepper',
  'sriracha': 'sauce hot chile pepper',
  'vinegar': 'vinegar distilled',
  'balsamic vinegar': 'vinegar balsamic',
  'balsamic': 'vinegar balsamic',
  'apple cider vinegar': 'vinegar cider',
  'rice vinegar': 'vinegar rice',
  'red wine vinegar': 'vinegar red wine',
  'white wine vinegar': 'vinegar white wine',

  // Seasonings
  'salt': 'salt table iodized',
  'table salt': 'salt table iodized',
  'kosher salt': 'salt table',
  'sea salt': 'salt table',
  'pepper': 'spices pepper black',
  'black pepper': 'spices pepper black',
  'ground pepper': 'spices pepper black',
  'ground black pepper': 'spices pepper black',
  'paprika': 'spices paprika',
  'cumin': 'spices cumin ground',
  'oregano': 'spices oregano dried',
  'basil': 'basil fresh',
  'dried basil': 'spices basil dried',
  'thyme': 'thyme fresh',
  'dried thyme': 'spices thyme dried',
  'rosemary': 'rosemary fresh',
  'dried rosemary': 'spices rosemary dried',
  'cinnamon': 'spices cinnamon ground',
  'nutmeg': 'spices nutmeg ground',
  'ginger': 'ginger root raw',
  'fresh ginger': 'ginger root raw',
  'ground ginger': 'spices ginger ground',
  'cayenne': 'spices pepper red cayenne',
  'cayenne pepper': 'spices pepper red cayenne',
  'chili powder': 'spices chili powder',
  'italian seasoning': 'spices italian seasoning',
  'garlic powder': 'spices garlic powder',
  'onion powder': 'spices onion powder',

  // Baking
  'baking powder': 'leavening agents baking powder',
  'baking soda': 'leavening agents baking soda',
  'vanilla extract': 'vanilla extract',
  'vanilla': 'vanilla extract',
  'cocoa powder': 'cocoa dry powder unsweetened',
  'chocolate chips': 'chocolate chips semisweet',
  'yeast': 'yeast bakers active dry',
};

/**
 * Parse an ingredient string into structured data
 * @param {string} ingredientText - Raw ingredient text from recipe
 * @returns {Object} Parsed ingredient with normalized fields
 */
export function parseIngredient(ingredientText) {
  if (!ingredientText || typeof ingredientText !== 'string') {
    return null;
  }

  let text = ingredientText.trim();
  const original = text;

  // Extract quantity
  let quantity = null;
  let unit = null;
  let remainingText = text;

  // Try to extract quantity
  for (const pattern of QUANTITY_PATTERNS) {
    const match = remainingText.match(pattern);
    if (match) {
      quantity = parseQuantityValue(match[1]);
      remainingText = remainingText.slice(match[0].length).trim();
      break;
    }
  }

  // Try to extract unit
  const unitMatch = remainingText.match(/^([a-zA-Z]+\.?)\s+/);
  if (unitMatch) {
    const potentialUnit = unitMatch[1].toLowerCase().replace(/\.$/, '');
    if (UNIT_MAP[potentialUnit]) {
      unit = UNIT_MAP[potentialUnit];
      remainingText = remainingText.slice(unitMatch[0].length).trim();
    }
  }

  // Clean the remaining text (ingredient name)
  let ingredientName = cleanIngredientName(remainingText);

  // Get search queries for USDA
  const searchQueries = generateSearchQueries(ingredientName);

  // Detect if cooked state is mentioned
  const cookedState = detectCookedState(original);

  return {
    original,
    quantity,
    unit,
    name: ingredientName,
    searchQueries,
    cookedState,
  };
}

/**
 * Parse quantity value handling fractions and ranges
 */
function parseQuantityValue(quantityStr) {
  if (!quantityStr) return null;

  // Handle ranges (take average)
  if (quantityStr.includes('-')) {
    const [low, high] = quantityStr.split('-').map(s => parseQuantityValue(s.trim()));
    if (low !== null && high !== null) {
      return (low + high) / 2;
    }
  }

  // Handle mixed numbers (e.g., "1 1/2")
  const mixedMatch = quantityStr.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const denom = parseInt(mixedMatch[3], 10);
    return whole + (num / denom);
  }

  // Handle fractions (e.g., "1/2")
  const fractionMatch = quantityStr.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10);
    const denom = parseInt(fractionMatch[2], 10);
    return num / denom;
  }

  // Handle decimals and whole numbers
  const value = parseFloat(quantityStr);
  return Number.isFinite(value) ? value : null;
}

/**
 * Clean ingredient name by removing descriptors, methods, etc.
 */
function cleanIngredientName(name) {
  let cleaned = name.toLowerCase();

  // Remove brand patterns
  for (const pattern of BRAND_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove parenthetical patterns
  for (const pattern of PAREN_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove any remaining parenthetical content (e.g., "(454g)" or "(or yellow onion)")
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ');

  // Remove cooking methods (but keep track of them)
  for (const method of COOKING_METHODS) {
    cleaned = cleaned.replace(new RegExp(`\\b${method}\\b`, 'gi'), '');
  }

  // Remove descriptors
  for (const descriptor of STRIP_DESCRIPTORS) {
    cleaned = cleaned.replace(new RegExp(`\\b${descriptor}\\b`, 'gi'), '');
  }

  // Remove extra punctuation and normalize spaces
  cleaned = cleaned
    .replace(/[,;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Detect if ingredient specifies cooked or raw state
 */
function detectCookedState(text) {
  const lower = text.toLowerCase();

  const cookedIndicators = [
    'cooked', 'boiled', 'steamed', 'fried', 'baked', 'roasted',
    'grilled', 'sauteed', 'sautéed', 'poached', 'braised',
  ];

  const rawIndicators = ['raw', 'uncooked', 'fresh'];

  for (const indicator of cookedIndicators) {
    if (lower.includes(indicator)) {
      return 'cooked';
    }
  }

  for (const indicator of rawIndicators) {
    if (lower.includes(indicator)) {
      return 'raw';
    }
  }

  return 'unknown'; // Default - will need to apply yield factors if cooking
}

/**
 * Generate multiple search queries for better USDA matching
 */
function generateSearchQueries(ingredientName) {
  const queries = [];
  const lower = ingredientName.toLowerCase().trim();

  // Check for known aliases first
  if (INGREDIENT_ALIASES[lower]) {
    queries.push(INGREDIENT_ALIASES[lower]);
  }

  // Try the cleaned name as-is
  if (lower && !queries.includes(lower)) {
    queries.push(lower);
  }

  // Try with "raw" appended for fresh ingredients
  const withRaw = `${lower} raw`;
  if (!queries.includes(withRaw)) {
    queries.push(withRaw);
  }

  // Try simplified versions (remove last word iteratively)
  const words = lower.split(' ').filter(w => w.length > 0);
  if (words.length > 1) {
    // Try without last word
    const simplified = words.slice(0, -1).join(' ');
    if (simplified && !queries.includes(simplified)) {
      queries.push(simplified);
    }

    // Try just first word if it's substantial
    if (words[0].length >= 4 && !queries.includes(words[0])) {
      queries.push(words[0]);
    }
  }

  return queries.slice(0, 5); // Max 5 queries
}

/**
 * Normalize a full recipe's ingredients
 */
export function normalizeRecipeIngredients(recipe) {
  if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) {
    return [];
  }

  return recipe.ingredients.map(ing => {
    // Handle both {name, quantity} format and plain strings
    const text = typeof ing === 'string'
      ? ing
      : `${ing.quantity || ''} ${ing.name || ''}`.trim();

    const parsed = parseIngredient(text);

    // If parsing succeeds, use parsed values; otherwise fall back
    if (parsed) {
      return {
        ...parsed,
        originalIngredient: ing,
      };
    }

    return {
      original: text,
      name: typeof ing === 'string' ? ing : ing.name,
      quantity: typeof ing === 'object' ? parseQuantityValue(ing.quantity) : null,
      unit: null,
      searchQueries: [typeof ing === 'string' ? ing : ing.name],
      cookedState: 'unknown',
      originalIngredient: ing,
    };
  });
}

export { INGREDIENT_ALIASES, UNIT_MAP };
