/**
 * Goal configurations and prompt builders for recipe modification
 * Two-phase approach: Calculate targets, then make substitutions to match them
 */

export const GOAL_CONFIGS = {
  bulk: {
    name: 'Bulk',
    description: 'Maximize muscle gain with calorie surplus',
    targets: {
      calories: '+300 to +500',
      protein: '+20 to +40g',
      carbs: 'can increase',
      fat: 'can increase'
    }
  },
  lean_bulk: {
    name: 'Lean Bulk',
    description: 'Build muscle with minimal fat gain',
    targets: {
      calories: '+150 to +250',
      protein: '+25 to +40g',
      carbs: 'slight increase okay',
      fat: 'keep same or lower'
    }
  },
  cut: {
    name: 'Cut',
    description: 'Lose fat while preserving muscle',
    targets: {
      calories: '-200 to -400',
      protein: 'maintain or increase',
      carbs: 'reduce',
      fat: 'reduce'
    }
  }
};

const CONDITION_LABELS = {
  celiac: 'Celiac (strict gluten-free)',
  diabetes: 'Diabetes / blood sugar',
  hypertension: 'Hypertension',
  high_cholesterol: 'High cholesterol',
  kidney: 'Kidney-friendly',
};

/**
 * Build the modification prompt with strict target matching requirements.
 * Accepts optional user context (quiz answers) to honor constraints and substitution plan.
 */
export function buildModificationPrompt(
  recipe,
  goalType,
  userContext = {},
  substitutionPlan = null
) {
  const config = GOAL_CONFIGS[goalType];
  if (!config) {
    throw new Error(`Invalid goal type: ${goalType}`);
  }

  const userProfile = formatUserContext(userContext);
  const conditionGuardrails = formatConditionGuardrails(userContext);
  const substitutionGuide = formatSubstitutionPlanForPrompt(substitutionPlan);

  return `You are a nutrition optimization expert. Your job is to modify recipes to hit specific macro targets.

## GOAL: ${config.name}
${config.description}

## TARGET CHANGES (per serving):
- Calories: ${config.targets.calories}
- Protein: ${config.targets.protein}
- Carbs: ${config.targets.carbs}
- Fat: ${config.targets.fat}

## ORIGINAL RECIPE
Title: ${recipe.title}
Servings: ${recipe.servings}

### Ingredients:
${recipe.ingredients.map((ing, i) => `${i + 1}. ${ing.quantity} ${ing.name}`).join('\n')}

### Steps:
${recipe.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

### Current Macros (per serving):
- Calories: ${recipe.macros.calories} kcal
- Protein: ${recipe.macros.protein}g
- Carbs: ${recipe.macros.carbs}g
- Fat: ${recipe.macros.fat}g

## USER PROFILE & CONSTRAINTS (from quiz)
${userProfile}

## MEDICAL / DIETARY GUARDRAILS
${conditionGuardrails}

## USDA-GUIDED SUBSTITUTION CANDIDATES (precomputed; DO NOT invent outside these)
${substitutionGuide}

---

## YOUR TASK (Two Phases)

### PHASE 1: Calculate Exact Macro Targets
Based on the goal, calculate SPECIFIC numeric targets for the modified recipe.
Example for Bulk: If original is 450 cal, target might be 800 cal (+350).

### PHASE 2: Make Substitutions to Hit Those Targets
You MUST modify ingredients to reach your Phase 1 targets. The final recipe macros MUST match your targets (within 5%).

## SUBSTITUTION PLAYBOOK (use these strategies):

**To INCREASE PROTEIN:**
- Swap chicken thigh → chicken breast (leaner, more protein per calorie)
- Swap 80/20 ground beef → 93/7 lean ground beef
- Add Greek yogurt (100g = 10g protein)
- Add egg whites (3 whites = 11g protein)
- Increase meat/fish portion size
- Add cottage cheese, tofu, or tempeh

**To INCREASE CALORIES (for bulk):**
- Add avocado (1/2 = 160 cal, healthy fats)
- Add nuts/nut butter (2 tbsp peanut butter = 190 cal)
- Drizzle olive oil (1 tbsp = 120 cal)
- Increase carb portions (more rice, pasta, bread)
- Use full-fat dairy instead of low-fat
- Add cheese

**To DECREASE CALORIES (for cut):**
- Reduce or eliminate oil/butter
- Use cooking spray instead of oil
- Remove or reduce cheese
- Reduce carb portions by 30-50%
- Swap rice → cauliflower rice
- Swap pasta → zucchini noodles
- Remove high-calorie toppings/sauces

**To DECREASE CARBS:**
- Rice → cauliflower rice
- Pasta → zucchini noodles or shirataki
- Bread → lettuce wrap
- Reduce portion of grains/starches
- Skip sugary sauces

---

## REQUIREMENTS (MUST follow):
1. You MUST make at least 2 ingredient modifications
2. Your modifiedRecipe.macros MUST match your macroTargets within 5%
3. Each modification MUST include the exact macro impact (macroDelta)
4. The sum of original macros + all macroDelta values MUST equal the new macros
5. Update cooking steps if your substitutions require different preparation
6. NEVER include ingredients that conflict with allergens, diet style, avoid-list, OR the medical guardrails above (celiac = zero gluten; hypertension = lower sodium; diabetes = lower glycemic load; kidney = moderate sodium/potassium; high_cholesterol = lower saturated fat)
7. Use ONLY the USDA candidate options above; if none are available for an ingredient, prefer portion adjustments or adds from the provided playbook rather than inventing new ingredients
8. Prioritize candidates with tasteScore/textureScore >= 4 and commonness >= 4 to preserve flavor and function; avoid uncommon or high-risk swaps
9. If you cannot fully satisfy a medical guardrail, choose the safest option available AND include a warning in the warnings array explaining the tradeoff

---

## OUTPUT FORMAT
Return a JSON object with this EXACT structure:
{
  "analysis": {
    "reasoning": "<why these specific modifications achieve the ${config.name} goal>",
    "topMacroDrivers": [
      {
        "ingredient": "<ingredient name>",
        "contribution": "<e.g., 'Provides 40% of total calories' or 'Main protein source at 25g'>"
      }
    ]
  },
  "edits": [
    {
      "lever": "substitute" | "adjust_portion" | "add" | "remove",
      "original": "<original ingredient with quantity, or null if adding>",
      "modified": "<new ingredient with quantity, or null if removing>",
      "reason": "<why this helps reach the goal>",
      "tasteScore": <1-5 rating of taste impact, 5 = no change>,
      "textureScore": <1-5 rating of texture impact, 5 = no change>,
      "macroDelta": {
        "calories": <change in calories>,
        "protein": <change in protein g>,
        "carbs": <change in carbs g>,
        "fat": <change in fat g>
      }
    }
  ],
  "stepUpdates": [
    {
      "stepNumber": <1-based index of step to modify>,
      "original": "<original step text>",
      "modified": "<updated step text reflecting ingredient changes>"
    }
  ],
  "modifiedRecipe": {
    "title": "<original title> (${config.name})",
    "servings": ${recipe.servings},
    "ingredients": [{ "name": "<string>", "quantity": "<string>" }],
    "steps": ["<complete updated steps array reflecting all ingredient changes>"],
    "macros": {
      "calories": <new total calories>,
      "protein": <new total protein g>,
      "carbs": <new total carbs g>,
      "fat": <new total fat g>
    }
  },
  "summary": {
    "originalMacros": { "calories": ${recipe.macros.calories}, "protein": ${recipe.macros.protein}, "carbs": ${recipe.macros.carbs}, "fat": ${recipe.macros.fat} },
    "newMacros": { "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number> },
    "totalChanges": <number of edits made>
  },
  "warnings": ["<taste/texture warnings>", "<cooking adjustment notes>", "<any allergen or dietary notes>"]
}

IMPORTANT REQUIREMENTS:
1. modifiedRecipe.ingredients MUST contain the FULL updated ingredient list (not just changes)
2. modifiedRecipe.steps MUST contain the FULL updated steps array (not just changes)
3. modifiedRecipe.macros MUST reflect the actual macros of the modified recipe
4. summary.newMacros MUST match modifiedRecipe.macros
5. Return ONLY valid JSON. No markdown, no explanation, just the JSON object.`;
}

function formatUserContext(ctx) {
  const lines = [];
  const conditions = Array.isArray(ctx?.conditions)
    ? ctx.conditions.filter((c) => typeof c === 'string')
    : [];
  if (ctx.biologicalSex) lines.push(`- Sex: ${ctx.biologicalSex}`);
  if (ctx.age) lines.push(`- Age: ${ctx.age}`);
  if (ctx.heightCm) lines.push(`- Height: ${ctx.heightCm} cm`);
  if (ctx.weightKg) lines.push(`- Weight: ${ctx.weightKg} kg`);
  if (ctx.goalWeightKg) lines.push(`- Goal weight: ${ctx.goalWeightKg} kg`);
  if (ctx.activityLevel) lines.push(`- Activity: ${ctx.activityLevel}`);
  if (ctx.pace) lines.push(`- Pace (1-5): ${ctx.pace}`);
  if (ctx.dietStyle && ctx.dietStyle !== 'none') lines.push(`- Diet style: ${ctx.dietStyle}`);
  if (conditions.length) {
    const readable = conditions.map((c) => CONDITION_LABELS[c] || c);
    lines.push(`- Conditions: ${readable.join(', ')}`);
  }
  if (Array.isArray(ctx.allergens) && ctx.allergens.length) {
    lines.push(`- Allergens to avoid: ${ctx.allergens.join(', ')}`);
  }
  if (ctx.avoidList) lines.push(`- Avoid list: ${ctx.avoidList}`);

  if (!lines.length) {
    return '- No additional user constraints provided';
  }
  return lines.join('\n');
}

function formatConditionGuardrails(ctx) {
  const conditions = Array.isArray(ctx?.conditions)
    ? ctx.conditions.filter((c) => typeof c === 'string')
    : [];

  if (!conditions.length) {
    return '- None reported.';
  }

  const lines = [];

  if (conditions.includes('celiac')) {
    lines.push('- Celiac: recipe MUST be gluten-free. Exclude wheat, barley, rye, malt, standard soy sauce/beer; prefer gluten-free flours, tamari, rice/corn starches.');
  }
  if (conditions.includes('diabetes')) {
    lines.push('- Diabetes: keep carbs lower-glycemic, minimize added sugars, prefer fiber-rich swaps, and note carb counts after edits.');
  }
  if (conditions.includes('hypertension')) {
    lines.push('- Hypertension: lower sodium. Avoid salty cured meats and high-sodium sauces; choose low-sodium alternatives.');
  }
  if (conditions.includes('high_cholesterol')) {
    lines.push('- High cholesterol: reduce saturated fat. Favor lean proteins and plant oils over butter/cream/fatty cuts.');
  }
  if (conditions.includes('kidney')) {
    lines.push('- Kidney-friendly: moderate sodium, potassium-heavy items (tomato, potato, spinach), and very high protein portions.');
  }

  return lines.join('\n');
}

function formatSubstitutionPlanForPrompt(plan) {
  if (!plan || !plan.ingredients || !plan.ingredients.length) {
    return '- No USDA-backed candidate table (fallback to portion tweaks and minor adds).';
  }

  return plan.ingredients.slice(0, 12).map((ing) => {
    const base = ing.baseMacros
      ? `Base: ${ing.baseMacros.calories} kcal, P ${ing.baseMacros.protein}g, C ${ing.baseMacros.carbs}g, F ${ing.baseMacros.fat}g (${ing.baseGrams || '?'}g)`
      : 'Base macros: unknown';

    const candidates = (ing.candidates || []).slice(0, 3).map((cand) => {
      return `- ${cand.name}: swap ${cand.swapGrams}g, Δkcal ${cand.macroDelta.calories}, ΔP ${cand.macroDelta.protein}g, ΔC ${cand.macroDelta.carbs}g, ΔF ${cand.macroDelta.fat}g; taste ${cand.tasteScore}/5, texture ${cand.textureScore}/5, score ${cand.score}`;
    }).join('\n');

    const fallback = candidates || '- No safe swaps; only adjust portion or add lean/low-fat options.';

    return `Ingredient: ${ing.name || ing.original} (${(ing.roles || []).join(', ') || 'uncategorized'})\n${base}\n${fallback}`;
  }).join('\n\n');
}
