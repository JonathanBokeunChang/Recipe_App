/**
 * Density Tables for Volumetric Conversions
 *
 * Provides accurate gram weights for volumetric measurements (cups, tbsp, tsp)
 * based on USDA data and verified sources.
 *
 * Values are grams per standard unit.
 */

// Comprehensive density data: grams per cup, tbsp, tsp
// Source: USDA FoodData Central + verified cooking references
export const DENSITY_DATA = {
  // ============================================
  // FLOURS & BAKING
  // ============================================
  'flour all purpose': { cup: 125, tbsp: 7.8, tsp: 2.6, category: 'flour' },
  'flour bread': { cup: 127, tbsp: 7.9, tsp: 2.6, category: 'flour' },
  'flour whole wheat': { cup: 120, tbsp: 7.5, tsp: 2.5, category: 'flour' },
  'flour cake': { cup: 114, tbsp: 7.1, tsp: 2.4, category: 'flour' },
  'flour pastry': { cup: 106, tbsp: 6.6, tsp: 2.2, category: 'flour' },
  'flour almond': { cup: 96, tbsp: 6, tsp: 2, category: 'flour' },
  'flour coconut': { cup: 112, tbsp: 7, tsp: 2.3, category: 'flour' },
  'flour rice': { cup: 158, tbsp: 9.9, tsp: 3.3, category: 'flour' },
  'cornstarch': { cup: 128, tbsp: 8, tsp: 2.7, category: 'flour' },
  'corn starch': { cup: 128, tbsp: 8, tsp: 2.7, category: 'flour' },
  'cornmeal': { cup: 157, tbsp: 9.8, tsp: 3.3, category: 'flour' },

  // ============================================
  // SUGARS & SWEETENERS
  // ============================================
  'sugar granulated': { cup: 200, tbsp: 12.5, tsp: 4.2, category: 'sugar' },
  'sugar white': { cup: 200, tbsp: 12.5, tsp: 4.2, category: 'sugar' },
  'sugar brown': { cup: 220, tbsp: 13.8, tsp: 4.6, category: 'sugar' },
  'sugar brown packed': { cup: 220, tbsp: 13.8, tsp: 4.6, category: 'sugar' },
  'sugar powdered': { cup: 120, tbsp: 7.5, tsp: 2.5, category: 'sugar' },
  'sugar confectioners': { cup: 120, tbsp: 7.5, tsp: 2.5, category: 'sugar' },
  'honey': { cup: 340, tbsp: 21, tsp: 7, category: 'sweetener' },
  'maple syrup': { cup: 322, tbsp: 20, tsp: 6.7, category: 'sweetener' },
  'syrups maple': { cup: 322, tbsp: 20, tsp: 6.7, category: 'sweetener' },
  'molasses': { cup: 328, tbsp: 20.5, tsp: 6.8, category: 'sweetener' },
  'corn syrup': { cup: 328, tbsp: 20.5, tsp: 6.8, category: 'sweetener' },
  'agave': { cup: 336, tbsp: 21, tsp: 7, category: 'sweetener' },
  'agave nectar': { cup: 336, tbsp: 21, tsp: 7, category: 'sweetener' },

  // ============================================
  // OILS & FATS
  // ============================================
  'oil olive': { cup: 216, tbsp: 13.5, tsp: 4.5, category: 'oil' },
  'oil olive extra virgin': { cup: 216, tbsp: 13.5, tsp: 4.5, category: 'oil' },
  'oil vegetable': { cup: 218, tbsp: 13.6, tsp: 4.5, category: 'oil' },
  'oil canola': { cup: 218, tbsp: 13.6, tsp: 4.5, category: 'oil' },
  'oil coconut': { cup: 218, tbsp: 13.6, tsp: 4.5, category: 'oil' },
  'oil sesame': { cup: 218, tbsp: 13.6, tsp: 4.5, category: 'oil' },
  'oil avocado': { cup: 218, tbsp: 13.6, tsp: 4.5, category: 'oil' },
  'oil peanut': { cup: 216, tbsp: 13.5, tsp: 4.5, category: 'oil' },
  'butter salted': { cup: 227, tbsp: 14.2, tsp: 4.7, category: 'fat' },
  'butter unsalted': { cup: 227, tbsp: 14.2, tsp: 4.7, category: 'fat' },
  'butter': { cup: 227, tbsp: 14.2, tsp: 4.7, category: 'fat' },
  'margarine': { cup: 227, tbsp: 14.2, tsp: 4.7, category: 'fat' },
  'shortening': { cup: 205, tbsp: 12.8, tsp: 4.3, category: 'fat' },
  'lard': { cup: 205, tbsp: 12.8, tsp: 4.3, category: 'fat' },
  'coconut oil': { cup: 218, tbsp: 13.6, tsp: 4.5, category: 'oil' },

  // ============================================
  // DAIRY
  // ============================================
  'milk whole': { cup: 244, tbsp: 15.3, tsp: 5.1, category: 'dairy' },
  'milk': { cup: 244, tbsp: 15.3, tsp: 5.1, category: 'dairy' },
  'milk skim': { cup: 245, tbsp: 15.3, tsp: 5.1, category: 'dairy' },
  'milk nonfat': { cup: 245, tbsp: 15.3, tsp: 5.1, category: 'dairy' },
  'milk 2%': { cup: 244, tbsp: 15.3, tsp: 5.1, category: 'dairy' },
  'milk reduced fat': { cup: 244, tbsp: 15.3, tsp: 5.1, category: 'dairy' },
  'buttermilk': { cup: 245, tbsp: 15.3, tsp: 5.1, category: 'dairy' },
  'cream heavy': { cup: 238, tbsp: 14.9, tsp: 5, category: 'dairy' },
  'cream heavy whipping': { cup: 238, tbsp: 14.9, tsp: 5, category: 'dairy' },
  'cream light': { cup: 240, tbsp: 15, tsp: 5, category: 'dairy' },
  'half and half': { cup: 242, tbsp: 15.1, tsp: 5, category: 'dairy' },
  'sour cream': { cup: 242, tbsp: 15.1, tsp: 5, category: 'dairy' },
  'yogurt': { cup: 245, tbsp: 15.3, tsp: 5.1, category: 'dairy' },
  'yogurt greek': { cup: 285, tbsp: 17.8, tsp: 5.9, category: 'dairy' },
  'yogurt greek plain nonfat': { cup: 285, tbsp: 17.8, tsp: 5.9, category: 'dairy' },
  'cream cheese': { cup: 232, tbsp: 14.5, tsp: 4.8, category: 'dairy' },
  'cottage cheese': { cup: 226, tbsp: 14.1, tsp: 4.7, category: 'dairy' },
  'ricotta cheese': { cup: 246, tbsp: 15.4, tsp: 5.1, category: 'dairy' },

  // ============================================
  // CHEESES (shredded/grated)
  // ============================================
  'cheese cheddar': { cup: 113, tbsp: 7.1, tsp: 2.4, category: 'cheese' },
  'cheese mozzarella': { cup: 113, tbsp: 7.1, tsp: 2.4, category: 'cheese' },
  'cheese mozzarella whole milk': { cup: 113, tbsp: 7.1, tsp: 2.4, category: 'cheese' },
  'cheese parmesan': { cup: 100, tbsp: 6.3, tsp: 2.1, category: 'cheese' },
  'cheese parmesan hard': { cup: 100, tbsp: 6.3, tsp: 2.1, category: 'cheese' },
  'cheese parmesan grated': { cup: 100, tbsp: 6.3, tsp: 2.1, category: 'cheese' },
  'cheese swiss': { cup: 108, tbsp: 6.8, tsp: 2.3, category: 'cheese' },
  'cheese feta': { cup: 150, tbsp: 9.4, tsp: 3.1, category: 'cheese' },
  'cheese goat': { cup: 144, tbsp: 9, tsp: 3, category: 'cheese' },
  'cheese blue': { cup: 135, tbsp: 8.4, tsp: 2.8, category: 'cheese' },

  // ============================================
  // GRAINS & RICE
  // ============================================
  'rice white long grain raw': { cup: 185, tbsp: 11.6, tsp: 3.9, category: 'grain' },
  'rice white': { cup: 185, tbsp: 11.6, tsp: 3.9, category: 'grain' },
  'rice brown long grain raw': { cup: 190, tbsp: 11.9, tsp: 4, category: 'grain' },
  'rice brown': { cup: 190, tbsp: 11.9, tsp: 4, category: 'grain' },
  'rice basmati': { cup: 180, tbsp: 11.3, tsp: 3.8, category: 'grain' },
  'rice jasmine': { cup: 185, tbsp: 11.6, tsp: 3.9, category: 'grain' },
  'rice arborio': { cup: 200, tbsp: 12.5, tsp: 4.2, category: 'grain' },
  'quinoa': { cup: 170, tbsp: 10.6, tsp: 3.5, category: 'grain' },
  'quinoa uncooked': { cup: 170, tbsp: 10.6, tsp: 3.5, category: 'grain' },
  'oats regular': { cup: 80, tbsp: 5, tsp: 1.7, category: 'grain' },
  'oats rolled': { cup: 80, tbsp: 5, tsp: 1.7, category: 'grain' },
  'oats steel cut': { cup: 160, tbsp: 10, tsp: 3.3, category: 'grain' },
  'oatmeal': { cup: 80, tbsp: 5, tsp: 1.7, category: 'grain' },
  'couscous': { cup: 173, tbsp: 10.8, tsp: 3.6, category: 'grain' },
  'bulgur': { cup: 140, tbsp: 8.8, tsp: 2.9, category: 'grain' },
  'barley': { cup: 184, tbsp: 11.5, tsp: 3.8, category: 'grain' },
  'farro': { cup: 170, tbsp: 10.6, tsp: 3.5, category: 'grain' },

  // ============================================
  // PASTA (dry)
  // ============================================
  'pasta dry': { cup: 100, tbsp: 6.3, tsp: 2.1, category: 'pasta' },
  'spaghetti dry': { cup: 100, tbsp: 6.3, tsp: 2.1, category: 'pasta' },
  'penne dry': { cup: 100, tbsp: 6.3, tsp: 2.1, category: 'pasta' },
  'macaroni dry': { cup: 100, tbsp: 6.3, tsp: 2.1, category: 'pasta' },
  'noodles egg dry': { cup: 80, tbsp: 5, tsp: 1.7, category: 'pasta' },

  // ============================================
  // LEGUMES (dry and cooked)
  // ============================================
  'beans black dry': { cup: 194, tbsp: 12.1, tsp: 4, category: 'legume' },
  'beans black cooked': { cup: 172, tbsp: 10.8, tsp: 3.6, category: 'legume' },
  'beans black canned drained': { cup: 172, tbsp: 10.8, tsp: 3.6, category: 'legume' },
  'beans kidney dry': { cup: 184, tbsp: 11.5, tsp: 3.8, category: 'legume' },
  'beans kidney canned drained': { cup: 177, tbsp: 11.1, tsp: 3.7, category: 'legume' },
  'beans pinto dry': { cup: 193, tbsp: 12.1, tsp: 4, category: 'legume' },
  'beans white': { cup: 179, tbsp: 11.2, tsp: 3.7, category: 'legume' },
  'chickpeas dry': { cup: 200, tbsp: 12.5, tsp: 4.2, category: 'legume' },
  'chickpeas canned drained': { cup: 164, tbsp: 10.3, tsp: 3.4, category: 'legume' },
  'lentils raw': { cup: 192, tbsp: 12, tsp: 4, category: 'legume' },
  'lentils cooked': { cup: 198, tbsp: 12.4, tsp: 4.1, category: 'legume' },

  // ============================================
  // NUTS & SEEDS
  // ============================================
  'nuts almonds': { cup: 143, tbsp: 8.9, tsp: 3, category: 'nut' },
  'nuts almonds sliced': { cup: 92, tbsp: 5.8, tsp: 1.9, category: 'nut' },
  'nuts walnuts': { cup: 117, tbsp: 7.3, tsp: 2.4, category: 'nut' },
  'nuts walnuts chopped': { cup: 117, tbsp: 7.3, tsp: 2.4, category: 'nut' },
  'nuts pecans': { cup: 109, tbsp: 6.8, tsp: 2.3, category: 'nut' },
  'nuts pecans chopped': { cup: 109, tbsp: 6.8, tsp: 2.3, category: 'nut' },
  'nuts cashews raw': { cup: 137, tbsp: 8.6, tsp: 2.9, category: 'nut' },
  'peanuts raw': { cup: 146, tbsp: 9.1, tsp: 3, category: 'nut' },
  'peanuts roasted': { cup: 146, tbsp: 9.1, tsp: 3, category: 'nut' },
  'pine nuts': { cup: 135, tbsp: 8.4, tsp: 2.8, category: 'nut' },
  'macadamia nuts': { cup: 134, tbsp: 8.4, tsp: 2.8, category: 'nut' },
  'hazelnuts': { cup: 135, tbsp: 8.4, tsp: 2.8, category: 'nut' },
  'seeds chia': { cup: 168, tbsp: 10.5, tsp: 3.5, category: 'seed' },
  'chia seeds': { cup: 168, tbsp: 10.5, tsp: 3.5, category: 'seed' },
  'seeds flax': { cup: 168, tbsp: 10.5, tsp: 3.5, category: 'seed' },
  'flaxseed': { cup: 168, tbsp: 10.5, tsp: 3.5, category: 'seed' },
  'seeds sunflower': { cup: 140, tbsp: 8.8, tsp: 2.9, category: 'seed' },
  'seeds pumpkin': { cup: 129, tbsp: 8.1, tsp: 2.7, category: 'seed' },
  'seeds sesame': { cup: 144, tbsp: 9, tsp: 3, category: 'seed' },

  // ============================================
  // NUT BUTTERS
  // ============================================
  'peanut butter': { cup: 258, tbsp: 16, tsp: 5.3, category: 'nut_butter' },
  'peanut butter smooth': { cup: 258, tbsp: 16, tsp: 5.3, category: 'nut_butter' },
  'almond butter': { cup: 256, tbsp: 16, tsp: 5.3, category: 'nut_butter' },
  'tahini': { cup: 240, tbsp: 15, tsp: 5, category: 'nut_butter' },
  'sunflower seed butter': { cup: 256, tbsp: 16, tsp: 5.3, category: 'nut_butter' },

  // ============================================
  // VEGETABLES (chopped/diced)
  // ============================================
  'onions raw': { cup: 160, tbsp: 10, tsp: 3.3, category: 'vegetable' },
  'onions chopped': { cup: 160, tbsp: 10, tsp: 3.3, category: 'vegetable' },
  'garlic raw': { cup: 136, tbsp: 8.5, tsp: 2.8, category: 'vegetable' },
  'garlic minced': { cup: 136, tbsp: 8.5, tsp: 2.8, clove: 3, category: 'vegetable' },
  'tomatoes red raw': { cup: 180, tbsp: 11.3, tsp: 3.8, category: 'vegetable' },
  'tomatoes chopped': { cup: 180, tbsp: 11.3, tsp: 3.8, category: 'vegetable' },
  'tomatoes cherry raw': { cup: 149, tbsp: 9.3, tsp: 3.1, category: 'vegetable' },
  'tomatoes diced canned': { cup: 240, tbsp: 15, tsp: 5, category: 'vegetable' },
  'tomato paste': { cup: 262, tbsp: 16.4, tsp: 5.5, category: 'vegetable' },
  'tomato sauce': { cup: 245, tbsp: 15.3, tsp: 5.1, category: 'vegetable' },
  'carrots raw': { cup: 128, tbsp: 8, tsp: 2.7, category: 'vegetable' },
  'carrots chopped': { cup: 128, tbsp: 8, tsp: 2.7, category: 'vegetable' },
  'celery raw': { cup: 101, tbsp: 6.3, tsp: 2.1, category: 'vegetable' },
  'peppers sweet raw': { cup: 149, tbsp: 9.3, tsp: 3.1, category: 'vegetable' },
  'peppers sweet red raw': { cup: 149, tbsp: 9.3, tsp: 3.1, category: 'vegetable' },
  'peppers sweet green raw': { cup: 149, tbsp: 9.3, tsp: 3.1, category: 'vegetable' },
  'broccoli raw': { cup: 91, tbsp: 5.7, tsp: 1.9, category: 'vegetable' },
  'broccoli florets': { cup: 91, tbsp: 5.7, tsp: 1.9, category: 'vegetable' },
  'spinach raw': { cup: 30, tbsp: 1.9, tsp: 0.6, category: 'vegetable' },
  'spinach chopped': { cup: 30, tbsp: 1.9, tsp: 0.6, category: 'vegetable' },
  'kale raw': { cup: 67, tbsp: 4.2, tsp: 1.4, category: 'vegetable' },
  'kale chopped': { cup: 67, tbsp: 4.2, tsp: 1.4, category: 'vegetable' },
  'lettuce iceberg raw': { cup: 72, tbsp: 4.5, tsp: 1.5, category: 'vegetable' },
  'lettuce romaine raw': { cup: 47, tbsp: 2.9, tsp: 1, category: 'vegetable' },
  'mushrooms white raw': { cup: 70, tbsp: 4.4, tsp: 1.5, category: 'vegetable' },
  'mushrooms sliced': { cup: 70, tbsp: 4.4, tsp: 1.5, category: 'vegetable' },
  'squash zucchini raw': { cup: 124, tbsp: 7.8, tsp: 2.6, category: 'vegetable' },
  'zucchini sliced': { cup: 124, tbsp: 7.8, tsp: 2.6, category: 'vegetable' },
  'cucumber raw': { cup: 104, tbsp: 6.5, tsp: 2.2, category: 'vegetable' },
  'cucumber with peel raw': { cup: 104, tbsp: 6.5, tsp: 2.2, category: 'vegetable' },
  'avocados raw': { cup: 150, tbsp: 9.4, tsp: 3.1, category: 'vegetable' },
  'avocado cubed': { cup: 150, tbsp: 9.4, tsp: 3.1, category: 'vegetable' },
  'corn sweet yellow raw': { cup: 154, tbsp: 9.6, tsp: 3.2, category: 'vegetable' },
  'corn kernels': { cup: 154, tbsp: 9.6, tsp: 3.2, category: 'vegetable' },
  'beans green raw': { cup: 100, tbsp: 6.3, tsp: 2.1, category: 'vegetable' },
  'asparagus raw': { cup: 134, tbsp: 8.4, tsp: 2.8, category: 'vegetable' },
  'cauliflower raw': { cup: 107, tbsp: 6.7, tsp: 2.2, category: 'vegetable' },
  'cabbage raw': { cup: 89, tbsp: 5.6, tsp: 1.9, category: 'vegetable' },
  'potatoes raw': { cup: 150, tbsp: 9.4, tsp: 3.1, category: 'vegetable' },
  'potatoes diced': { cup: 150, tbsp: 9.4, tsp: 3.1, category: 'vegetable' },
  'sweet potato raw': { cup: 133, tbsp: 8.3, tsp: 2.8, category: 'vegetable' },

  // ============================================
  // FRUITS
  // ============================================
  'apples raw with skin': { cup: 125, tbsp: 7.8, tsp: 2.6, category: 'fruit' },
  'apples chopped': { cup: 125, tbsp: 7.8, tsp: 2.6, category: 'fruit' },
  'bananas raw': { cup: 150, tbsp: 9.4, tsp: 3.1, category: 'fruit' },
  'bananas sliced': { cup: 150, tbsp: 9.4, tsp: 3.1, category: 'fruit' },
  'strawberries raw': { cup: 152, tbsp: 9.5, tsp: 3.2, category: 'fruit' },
  'strawberries sliced': { cup: 166, tbsp: 10.4, tsp: 3.5, category: 'fruit' },
  'blueberries raw': { cup: 148, tbsp: 9.3, tsp: 3.1, category: 'fruit' },
  'raspberries raw': { cup: 123, tbsp: 7.7, tsp: 2.6, category: 'fruit' },
  'grapes raw': { cup: 151, tbsp: 9.4, tsp: 3.1, category: 'fruit' },
  'oranges raw': { cup: 180, tbsp: 11.3, tsp: 3.8, category: 'fruit' },
  'lemons raw': { cup: 212, tbsp: 13.3, tsp: 4.4, category: 'fruit' },
  'lemon juice raw': { cup: 244, tbsp: 15.3, tsp: 5.1, category: 'fruit' },
  'limes raw': { cup: 230, tbsp: 14.4, tsp: 4.8, category: 'fruit' },
  'lime juice raw': { cup: 246, tbsp: 15.4, tsp: 5.1, category: 'fruit' },
  'mango': { cup: 165, tbsp: 10.3, tsp: 3.4, category: 'fruit' },
  'pineapple': { cup: 165, tbsp: 10.3, tsp: 3.4, category: 'fruit' },
  'peaches': { cup: 154, tbsp: 9.6, tsp: 3.2, category: 'fruit' },
  'raisins': { cup: 165, tbsp: 10.3, tsp: 3.4, category: 'fruit' },
  'dates': { cup: 178, tbsp: 11.1, tsp: 3.7, category: 'fruit' },

  // ============================================
  // PROTEINS (raw, for reference)
  // ============================================
  'chicken broiler breast meat raw': { cup: 140, tbsp: 8.8, tsp: 2.9, category: 'protein' },
  'chicken breast': { cup: 140, tbsp: 8.8, tsp: 2.9, category: 'protein' },
  'beef ground 85% lean raw': { cup: 226, tbsp: 14.1, tsp: 4.7, category: 'protein' },
  'turkey ground raw': { cup: 226, tbsp: 14.1, tsp: 4.7, category: 'protein' },
  'egg whole raw': { large: 50, medium: 44, small: 38, category: 'protein' },
  'egg whites': { cup: 243, tbsp: 15.2, tsp: 5.1, large: 33, category: 'protein' },
  'egg yolks': { cup: 243, tbsp: 15.2, tsp: 5.1, large: 17, category: 'protein' },
  'tofu firm raw': { cup: 252, tbsp: 15.8, tsp: 5.3, category: 'protein' },
  'shrimp raw': { cup: 145, tbsp: 9.1, tsp: 3, category: 'protein' },
  'salmon atlantic raw': { cup: 170, tbsp: 10.6, tsp: 3.5, category: 'protein' },

  // ============================================
  // CONDIMENTS & SAUCES
  // ============================================
  'soy sauce': { cup: 255, tbsp: 16, tsp: 5.3, category: 'condiment' },
  'worcestershire sauce': { cup: 272, tbsp: 17, tsp: 5.7, category: 'condiment' },
  'ketchup': { cup: 272, tbsp: 17, tsp: 5.7, category: 'condiment' },
  'mustard prepared yellow': { cup: 249, tbsp: 15.6, tsp: 5.2, category: 'condiment' },
  'mayonnaise': { cup: 232, tbsp: 14.5, tsp: 4.8, category: 'condiment' },
  'vinegar distilled': { cup: 238, tbsp: 14.9, tsp: 5, category: 'condiment' },
  'vinegar balsamic': { cup: 255, tbsp: 15.9, tsp: 5.3, category: 'condiment' },
  'vinegar cider': { cup: 239, tbsp: 14.9, tsp: 5, category: 'condiment' },
  'vinegar rice': { cup: 239, tbsp: 14.9, tsp: 5, category: 'condiment' },
  'hot sauce': { cup: 273, tbsp: 17.1, tsp: 5.7, category: 'condiment' },
  'sauce hot chile pepper': { cup: 273, tbsp: 17.1, tsp: 5.7, category: 'condiment' },

  // ============================================
  // SPICES & SEASONINGS
  // ============================================
  'salt table': { cup: 292, tbsp: 18.3, tsp: 6.1, category: 'seasoning' },
  'pepper black': { cup: 105, tbsp: 6.6, tsp: 2.2, category: 'seasoning' },
  'spices paprika': { cup: 109, tbsp: 6.8, tsp: 2.3, category: 'seasoning' },
  'spices cumin ground': { cup: 104, tbsp: 6.5, tsp: 2.2, category: 'seasoning' },
  'spices cinnamon ground': { cup: 125, tbsp: 7.8, tsp: 2.6, category: 'seasoning' },
  'spices oregano dried': { cup: 27, tbsp: 1.7, tsp: 0.6, category: 'seasoning' },
  'spices basil dried': { cup: 24, tbsp: 1.5, tsp: 0.5, category: 'seasoning' },
  'spices thyme dried': { cup: 41, tbsp: 2.6, tsp: 0.9, category: 'seasoning' },
  'spices rosemary dried': { cup: 40, tbsp: 2.5, tsp: 0.8, category: 'seasoning' },
  'spices garlic powder': { cup: 155, tbsp: 9.7, tsp: 3.2, category: 'seasoning' },
  'spices onion powder': { cup: 108, tbsp: 6.8, tsp: 2.3, category: 'seasoning' },
  'spices chili powder': { cup: 128, tbsp: 8, tsp: 2.7, category: 'seasoning' },
  'spices cayenne': { cup: 90, tbsp: 5.6, tsp: 1.9, category: 'seasoning' },
  'spices pepper red cayenne': { cup: 90, tbsp: 5.6, tsp: 1.9, category: 'seasoning' },
  'spices ginger ground': { cup: 96, tbsp: 6, tsp: 2, category: 'seasoning' },
  'spices nutmeg ground': { cup: 112, tbsp: 7, tsp: 2.3, category: 'seasoning' },
  'spices italian seasoning': { cup: 32, tbsp: 2, tsp: 0.7, category: 'seasoning' },
  'basil fresh': { cup: 24, tbsp: 1.5, tsp: 0.5, category: 'herb' },
  'thyme fresh': { cup: 28, tbsp: 1.8, tsp: 0.6, category: 'herb' },
  'rosemary fresh': { cup: 25, tbsp: 1.6, tsp: 0.5, category: 'herb' },
  'cilantro fresh': { cup: 16, tbsp: 1, tsp: 0.3, category: 'herb' },
  'parsley fresh': { cup: 60, tbsp: 3.8, tsp: 1.3, category: 'herb' },
  'mint fresh': { cup: 48, tbsp: 3, tsp: 1, category: 'herb' },
  'ginger root raw': { cup: 96, tbsp: 6, tsp: 2, category: 'herb' },

  // ============================================
  // BAKING INGREDIENTS
  // ============================================
  'leavening agents baking powder': { cup: 230, tbsp: 14.4, tsp: 4.8, category: 'baking' },
  'leavening agents baking soda': { cup: 230, tbsp: 14.4, tsp: 4.8, category: 'baking' },
  'yeast bakers active dry': { cup: 144, tbsp: 9, tsp: 3, category: 'baking' },
  'vanilla extract': { cup: 208, tbsp: 13, tsp: 4.3, category: 'baking' },
  'cocoa dry powder unsweetened': { cup: 86, tbsp: 5.4, tsp: 1.8, category: 'baking' },
  'chocolate chips semisweet': { cup: 168, tbsp: 10.5, tsp: 3.5, category: 'baking' },
  'coconut shredded': { cup: 93, tbsp: 5.8, tsp: 1.9, category: 'baking' },
  'breadcrumbs': { cup: 108, tbsp: 6.8, tsp: 2.3, category: 'baking' },
  'breadcrumbs panko': { cup: 60, tbsp: 3.8, tsp: 1.3, category: 'baking' },

  // ============================================
  // LIQUIDS (for completeness)
  // ============================================
  'water': { cup: 237, tbsp: 14.8, tsp: 4.9, category: 'liquid' },
  'broth chicken': { cup: 240, tbsp: 15, tsp: 5, category: 'liquid' },
  'broth beef': { cup: 240, tbsp: 15, tsp: 5, category: 'liquid' },
  'broth vegetable': { cup: 240, tbsp: 15, tsp: 5, category: 'liquid' },
  'stock chicken': { cup: 240, tbsp: 15, tsp: 5, category: 'liquid' },
  'wine red': { cup: 236, tbsp: 14.8, tsp: 4.9, category: 'liquid' },
  'wine white': { cup: 236, tbsp: 14.8, tsp: 4.9, category: 'liquid' },
  'beer': { cup: 240, tbsp: 15, tsp: 5, category: 'liquid' },
  'coconut milk': { cup: 240, tbsp: 15, tsp: 5, category: 'liquid' },
  'almond milk': { cup: 244, tbsp: 15.3, tsp: 5.1, category: 'liquid' },
};

// Generic fallbacks by category
const CATEGORY_FALLBACKS = {
  flour: { cup: 125, tbsp: 7.8, tsp: 2.6 },
  sugar: { cup: 200, tbsp: 12.5, tsp: 4.2 },
  sweetener: { cup: 330, tbsp: 20.6, tsp: 6.9 },
  oil: { cup: 218, tbsp: 13.6, tsp: 4.5 },
  fat: { cup: 227, tbsp: 14.2, tsp: 4.7 },
  dairy: { cup: 244, tbsp: 15.3, tsp: 5.1 },
  cheese: { cup: 113, tbsp: 7.1, tsp: 2.4 },
  grain: { cup: 180, tbsp: 11.3, tsp: 3.8 },
  pasta: { cup: 100, tbsp: 6.3, tsp: 2.1 },
  legume: { cup: 180, tbsp: 11.3, tsp: 3.8 },
  nut: { cup: 130, tbsp: 8.1, tsp: 2.7 },
  seed: { cup: 150, tbsp: 9.4, tsp: 3.1 },
  nut_butter: { cup: 256, tbsp: 16, tsp: 5.3 },
  vegetable: { cup: 130, tbsp: 8.1, tsp: 2.7 },
  fruit: { cup: 150, tbsp: 9.4, tsp: 3.1 },
  protein: { cup: 170, tbsp: 10.6, tsp: 3.5 },
  condiment: { cup: 250, tbsp: 15.6, tsp: 5.2 },
  seasoning: { cup: 110, tbsp: 6.9, tsp: 2.3 },
  herb: { cup: 30, tbsp: 1.9, tsp: 0.6 },
  baking: { cup: 150, tbsp: 9.4, tsp: 3.1 },
  liquid: { cup: 240, tbsp: 15, tsp: 5 },
};

// Ultimate fallback (water-like density)
const DEFAULT_FALLBACK = { cup: 240, tbsp: 15, tsp: 5 };

/**
 * Get density data for a given ingredient
 * @param {string} ingredientName - Normalized ingredient name
 * @param {string} fdcDescription - USDA description for better matching
 * @returns {Object} Density data with cup, tbsp, tsp values
 */
export function getDensityData(ingredientName, fdcDescription = null) {
  const nameLower = (ingredientName || '').toLowerCase().trim();
  const fdcLower = (fdcDescription || '').toLowerCase().trim();

  // Try exact match first
  if (DENSITY_DATA[nameLower]) {
    return { ...DENSITY_DATA[nameLower], matchType: 'exact' };
  }

  // Try FDC description match
  if (fdcLower && DENSITY_DATA[fdcLower]) {
    return { ...DENSITY_DATA[fdcLower], matchType: 'fdc_exact' };
  }

  // Try partial matching
  for (const [key, data] of Object.entries(DENSITY_DATA)) {
    if (nameLower.includes(key) || key.includes(nameLower)) {
      return { ...data, matchType: 'partial' };
    }
    if (fdcLower && (fdcLower.includes(key) || key.includes(fdcLower))) {
      return { ...data, matchType: 'fdc_partial' };
    }
  }

  // Try category-based fallback using FDC description
  const category = detectCategory(nameLower, fdcLower);
  if (category && CATEGORY_FALLBACKS[category]) {
    return { ...CATEGORY_FALLBACKS[category], category, matchType: 'category' };
  }

  // Ultimate fallback
  return { ...DEFAULT_FALLBACK, matchType: 'default' };
}

/**
 * Detect ingredient category from name/description
 */
function detectCategory(name, fdc) {
  const combined = `${name} ${fdc}`.toLowerCase();

  if (/flour|starch/.test(combined)) return 'flour';
  if (/sugar|sweetener|syrup|honey|molasses/.test(combined)) return 'sugar';
  if (/oil|olive|canola|vegetable oil|coconut oil/.test(combined)) return 'oil';
  if (/butter|margarine|shortening|lard/.test(combined)) return 'fat';
  if (/milk|cream|yogurt|sour cream/.test(combined)) return 'dairy';
  if (/cheese/.test(combined)) return 'cheese';
  if (/rice|quinoa|oat|barley|farro|bulgur|couscous/.test(combined)) return 'grain';
  if (/pasta|spaghetti|noodle|penne|macaroni/.test(combined)) return 'pasta';
  if (/bean|lentil|chickpea|pea/.test(combined)) return 'legume';
  if (/nut|almond|walnut|pecan|cashew|peanut|pistachio|macadamia/.test(combined)) return 'nut';
  if (/seed|chia|flax|sunflower|pumpkin|sesame/.test(combined)) return 'seed';
  if (/butter/.test(combined) && /peanut|almond|cashew|sunflower/.test(combined)) return 'nut_butter';
  if (/chicken|beef|pork|turkey|fish|salmon|shrimp|egg|tofu|tempeh/.test(combined)) return 'protein';
  if (/sauce|ketchup|mustard|mayo|vinegar/.test(combined)) return 'condiment';
  if (/spice|powder|ground|dried|seasoning/.test(combined)) return 'seasoning';
  if (/fresh|basil|cilantro|parsley|mint|thyme|rosemary/.test(combined)) return 'herb';
  if (/broth|stock|water|wine|beer/.test(combined)) return 'liquid';
  if (/baking|yeast|extract|cocoa|chocolate/.test(combined)) return 'baking';
  if (/fruit|apple|banana|berry|orange|lemon|lime|mango|peach/.test(combined)) return 'fruit';
  if (/vegetable|onion|garlic|tomato|carrot|celery|pepper|broccoli|spinach/.test(combined)) return 'vegetable';

  return null;
}

/**
 * Convert volumetric measurement to grams
 * @param {number} quantity - Amount in original unit
 * @param {string} unit - Unit (cup, tbsp, tsp, etc.)
 * @param {string} ingredientName - Ingredient for density lookup
 * @param {string} fdcDescription - Optional FDC description
 * @returns {Object} { grams, confidence, densitySource }
 */
export function volumeToGrams(quantity, unit, ingredientName, fdcDescription = null) {
  if (!quantity || !Number.isFinite(quantity) || quantity <= 0) {
    return { grams: null, confidence: 'failed', error: 'Invalid quantity' };
  }

  const density = getDensityData(ingredientName, fdcDescription);
  const normalizedUnit = normalizeUnit(unit);

  // Direct weight units - no conversion needed
  const weightUnits = {
    g: 1,
    kg: 1000,
    mg: 0.001,
    oz: 28.3495,
    lb: 453.592,
  };

  if (weightUnits[normalizedUnit]) {
    return {
      grams: quantity * weightUnits[normalizedUnit],
      confidence: 'high',
      densitySource: 'weight_unit',
    };
  }

  // Volume units
  if (density[normalizedUnit]) {
    return {
      grams: quantity * density[normalizedUnit],
      confidence: density.matchType === 'exact' || density.matchType === 'fdc_exact' ? 'high' :
                  density.matchType === 'partial' || density.matchType === 'fdc_partial' ? 'medium' : 'low',
      densitySource: density.matchType,
    };
  }

  // Handle count units (piece, slice, clove, etc.)
  if (normalizedUnit === 'clove' && density.clove) {
    return {
      grams: quantity * density.clove,
      confidence: 'medium',
      densitySource: 'count_unit',
    };
  }

  if (['large', 'medium', 'small'].includes(normalizedUnit) && density[normalizedUnit]) {
    return {
      grams: quantity * density[normalizedUnit],
      confidence: 'medium',
      densitySource: 'size_unit',
    };
  }

  // Fallback for unknown units - use tbsp as approximation
  if (density.tbsp) {
    return {
      grams: quantity * density.tbsp,
      confidence: 'low',
      densitySource: 'fallback_tbsp',
      warning: `Unknown unit "${unit}", approximated as tbsp`,
    };
  }

  return {
    grams: quantity * 15, // Ultimate fallback: 1 unit = 15g (tbsp of water)
    confidence: 'very_low',
    densitySource: 'ultimate_fallback',
    warning: `Could not determine conversion for "${unit}"`,
  };
}

/**
 * Normalize unit string
 */
function normalizeUnit(unit) {
  if (!unit) return null;
  const lower = unit.toLowerCase().trim();

  const unitMap = {
    'cup': 'cup', 'cups': 'cup', 'c': 'cup',
    'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbsp': 'tbsp', 'tbs': 'tbsp', 'tb': 'tbsp',
    'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsp': 'tsp',
    'gram': 'g', 'grams': 'g', 'g': 'g',
    'kilogram': 'kg', 'kilograms': 'kg', 'kg': 'kg',
    'milligram': 'mg', 'milligrams': 'mg', 'mg': 'mg',
    'ounce': 'oz', 'ounces': 'oz', 'oz': 'oz',
    'pound': 'lb', 'pounds': 'lb', 'lb': 'lb', 'lbs': 'lb',
    'clove': 'clove', 'cloves': 'clove',
    'large': 'large', 'medium': 'medium', 'small': 'small',
    'piece': 'piece', 'pieces': 'piece',
    'slice': 'slice', 'slices': 'slice',
    'whole': 'whole',
  };

  return unitMap[lower] || lower;
}

export { CATEGORY_FALLBACKS, DEFAULT_FALLBACK };
