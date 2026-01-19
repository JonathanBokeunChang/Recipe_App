import type { QuizState } from '@/components/quiz-state';

export type MacroGoals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type CalculationResult = {
  macros: MacroGoals | null;
  bmr: number | null;
  tdee: number | null;
  goalAdjustment: number;
  isComplete: boolean;
  missingFields: string[];
};

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<string, { base: number; perPace: number }> = {
  bulk: { base: 300, perPace: 50 },
  lean_bulk: { base: 150, perPace: 25 },
  maintain: { base: 0, perPace: 0 },
  cut: { base: -300, perPace: -50 },
};

/**
 * Calculate BMR using Mifflin-St Jeor equation
 */
export function calculateBMR(
  sex: 'female' | 'male' | 'unspecified' | null,
  age: number,
  heightCm: number,
  weightKg: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;

  if (sex === 'male') return Math.round(base + 5);
  if (sex === 'female') return Math.round(base - 161);
  // unspecified: average of male and female
  return Math.round((base + 5 + base - 161) / 2);
}

/**
 * Get activity level multiplier for TDEE calculation
 */
export function getActivityMultiplier(
  activityLevel: string | null
): number {
  if (!activityLevel || !(activityLevel in ACTIVITY_MULTIPLIERS)) {
    return 1.2; // default to sedentary
  }
  return ACTIVITY_MULTIPLIERS[activityLevel];
}

/**
 * Get calorie adjustment based on goal and pace
 */
export function getGoalAdjustment(
  goal: string | null,
  pace: number
): number {
  if (!goal || !(goal in GOAL_ADJUSTMENTS)) {
    return 0;
  }
  const config = GOAL_ADJUSTMENTS[goal];
  const paceOffset = (pace - 3) * config.perPace; // pace 3 is baseline
  return config.base + paceOffset;
}

/**
 * Calculate macro split based on target calories, goal, and body weight
 */
export function calculateMacroSplit(
  targetCalories: number,
  goal: string | null,
  weightKg: number
): MacroGoals {
  // Protein: 1.6-2.2g per kg based on goal
  let proteinPerKg = 1.8;
  if (goal === 'cut') proteinPerKg = 2.2;
  else if (goal === 'bulk') proteinPerKg = 1.6;
  else if (goal === 'lean_bulk') proteinPerKg = 2.0;

  const protein = Math.round(weightKg * proteinPerKg);
  const proteinCalories = protein * 4;

  const remainingCalories = targetCalories - proteinCalories;

  // Split remaining between carbs and fat based on goal
  let carbsRatio = 0.55; // percentage of remaining calories
  if (goal === 'cut') carbsRatio = 0.45;
  else if (goal === 'bulk') carbsRatio = 0.60;

  const carbsCalories = remainingCalories * carbsRatio;
  const fatCalories = remainingCalories * (1 - carbsRatio);

  const carbs = Math.round(carbsCalories / 4);
  const fat = Math.round(fatCalories / 9);

  return {
    calories: Math.round(targetCalories),
    protein,
    carbs,
    fat,
  };
}

/**
 * Check which required fields are missing for calculation
 */
export function getMissingFields(quiz: Partial<QuizState>): string[] {
  const missing: string[] = [];

  if (quiz.biologicalSex == null) missing.push('Biological sex');
  if (quiz.age == null) missing.push('Age');
  if (quiz.heightCm == null) missing.push('Height');
  if (quiz.weightKg == null) missing.push('Weight');
  if (quiz.activityLevel == null) missing.push('Activity level');
  if (quiz.goal == null) missing.push('Goal');

  return missing;
}

/**
 * Main calculation function - orchestrates all calculations
 */
export function calculateMacros(quiz: Partial<QuizState>): CalculationResult {
  const missingFields = getMissingFields(quiz);

  if (missingFields.length > 0) {
    return {
      macros: null,
      bmr: null,
      tdee: null,
      goalAdjustment: 0,
      isComplete: false,
      missingFields,
    };
  }

  const { biologicalSex, age, heightCm, weightKg, activityLevel, goal, pace = 3 } = quiz;

  const bmr = calculateBMR(biologicalSex!, age!, heightCm!, weightKg!);
  const activityMultiplier = getActivityMultiplier(activityLevel!);
  const tdee = Math.round(bmr * activityMultiplier);
  const goalAdjustment = getGoalAdjustment(goal!, pace);
  const targetCalories = Math.max(1200, Math.min(5000, tdee + goalAdjustment));

  const macros = calculateMacroSplit(targetCalories, goal!, weightKg!);

  return {
    macros,
    bmr,
    tdee,
    goalAdjustment,
    isComplete: true,
    missingFields: [],
  };
}

/**
 * Format goal name for display
 */
export function formatGoalName(goal: string | null): string {
  if (!goal) return 'Unknown';
  const names: Record<string, string> = {
    bulk: 'Bulk',
    lean_bulk: 'Lean Bulk',
    cut: 'Cut',
    maintain: 'Maintain',
  };
  return names[goal] ?? goal;
}
