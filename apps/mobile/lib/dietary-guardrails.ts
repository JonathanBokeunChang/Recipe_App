import type { DietaryCondition } from '@/components/quiz-state';

export type ConditionWarning = {
  condition: DietaryCondition;
  label: string;
  message: string;
  hits: string[];
  suggestion?: string;
  severity?: 'info' | 'warning';
};

const CONDITION_LABELS: Record<DietaryCondition, string> = {
  celiac: 'Celiac / gluten-free',
  diabetes: 'Diabetes / blood sugar',
  hypertension: 'Hypertension',
  high_cholesterol: 'High cholesterol',
  kidney: 'Kidney-friendly',
};

function normalizeIngredients(recipe: any): string[] {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  return ingredients
    .map((ing) => `${ing?.quantity ?? ''} ${ing?.name ?? ''}`.toLowerCase())
    .filter(Boolean);
}

function findMatches(ingredients: string[], keywords: string[]): string[] {
  const hits = new Set<string>();
  for (const keyword of keywords) {
    for (const item of ingredients) {
      if (item.includes(keyword)) {
        hits.add(keyword);
        break;
      }
    }
  }
  return Array.from(hits);
}

export function analyzeRecipeForConditions(
  recipe: any,
  conditions: DietaryCondition[] = []
): ConditionWarning[] {
  if (!recipe || !conditions.length) return [];

  const ingredients = normalizeIngredients(recipe);
  const warnings: ConditionWarning[] = [];
  const macros = recipe?.macros || {};
  const carbs = Number(macros.carbs);
  const protein = Number(macros.protein);

  const addWarning = (
    condition: DietaryCondition,
    message: string,
    hits: string[],
    suggestion?: string
  ) => {
    warnings.push({
      condition,
      label: CONDITION_LABELS[condition],
      message,
      hits,
      suggestion,
      severity: 'warning',
    });
  };

  if (conditions.includes('celiac')) {
    const hits = findMatches(ingredients, [
      'flour',
      'wheat',
      'barley',
      'rye',
      'malt',
      'breadcrumb',
      'panko',
      'soy sauce',
      'beer',
    ]);
    if (hits.length) {
      addWarning(
        'celiac',
        'Gluten sources detected. Use gluten-free flour blends, cornstarch, or tamari/aminos instead.',
        hits,
        'Swap breading for cornmeal/rice crumbs; use gluten-free soy sauce or coconut aminos.'
      );
    }
  }

  if (conditions.includes('diabetes')) {
    const hits = findMatches(ingredients, [
      'sugar',
      'brown sugar',
      'honey',
      'syrup',
      'sweetened',
      'condensed milk',
      'white rice',
      'white bread',
      'flour tortilla',
      'pasta',
    ]);
    if (Number.isFinite(carbs) && carbs > 70) {
      hits.push(`~${Math.round(carbs)}g carbs/serving`);
    }
    if (hits.length) {
      addWarning(
        'diabetes',
        'Recipe is carb-heavy or contains added sugars. Favor fiber-rich carbs and portion control.',
        hits,
        'Swap to whole grains, add non-starchy veggies, and reduce sweeteners.'
      );
    }
  }

  if (conditions.includes('hypertension')) {
    const hits = findMatches(ingredients, [
      'salt',
      'soy sauce',
      'tamari',
      'fish sauce',
      'broth',
      'bouillon',
      'bacon',
      'sausage',
      'ham',
      'cured',
      'pickled',
      'canned',
    ]);
    if (hits.length) {
      addWarning(
        'hypertension',
        'Potentially high-sodium ingredients found. Use low-sodium swaps and watch added salt.',
        hits,
        'Use low-sodium broth/soy sauce, drain canned items, and finish with herbs/citrus instead of salt.'
      );
    }
  }

  if (conditions.includes('high_cholesterol')) {
    const hits = findMatches(ingredients, [
      'butter',
      'heavy cream',
      'cream cheese',
      'cheddar',
      'mozzarella',
      'whole milk',
      'bacon',
      'sausage',
      'ribeye',
      'short rib',
      'pork belly',
      'lard',
      'ghee',
      'egg yolk',
    ]);
    if (hits.length) {
      addWarning(
        'high_cholesterol',
        'High saturated fat items present. Lean proteins and plant oils are safer defaults.',
        hits,
        'Swap butter/cream for olive oil or Greek yogurt; choose lean poultry or fish over fatty cuts.'
      );
    }
  }

  if (conditions.includes('kidney')) {
    const hits = findMatches(ingredients, [
      'soy sauce',
      'salt',
      'broth',
      'spinach',
      'tomato',
      'potato',
      'beans',
      'lentil',
      'avocado',
      'banana',
      'dark greens',
    ]);
    if (Number.isFinite(protein) && protein > 45) {
      hits.push(`~${Math.round(protein)}g protein/serving`);
    }
    if (hits.length) {
      addWarning(
        'kidney',
        'Recipe may be high in sodium, potassium, or protein. Adjust portions and choose gentle seasonings.',
        hits,
        'Use herbs/acid instead of salty sauces, and balance protein portions with lower-potassium sides.'
      );
    }
  }

  return warnings;
}
