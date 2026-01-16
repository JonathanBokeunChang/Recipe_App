import { supabase } from '../supabaseClient';

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  servings: number;
  ingredients: { name: string; quantity: string }[];
  steps: string[];
  macros: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  times?: {
    prepMinutes?: number;
    cookMinutes?: number;
  };
  assumptions?: string[];
  source_url?: string;
  goal_type?: 'bulk' | 'lean_bulk' | 'cut' | null;
  is_modified: boolean;
  original_recipe_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveRecipeInput {
  title: string;
  servings?: number;
  ingredients: { name: string; quantity: string }[];
  steps: string[];
  macros?: Recipe['macros'];
  times?: Recipe['times'];
  assumptions?: string[];
  source_url?: string;
  goal_type?: 'bulk' | 'lean_bulk' | 'cut' | null;
  is_modified?: boolean;
  original_recipe_id?: string | null;
}

/**
 * Save a recipe to the user's library
 */
export async function saveRecipe(
  recipe: SaveRecipeInput,
  userId: string
): Promise<Recipe> {
  console.log('[recipes] saving recipe for user:', userId);
  console.log('[recipes] recipe title:', recipe.title);

  const insertData = {
    user_id: userId,
    title: recipe.title || 'Untitled Recipe',
    servings: recipe.servings ?? 2,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    macros: recipe.macros ?? {},
    times: recipe.times ?? {},
    assumptions: recipe.assumptions ?? [],
    source_url: recipe.source_url || null,
    goal_type: recipe.goal_type || null,
    is_modified: recipe.is_modified ?? false,
    original_recipe_id: recipe.original_recipe_id || null,
  };

  console.log('[recipes] insert data:', JSON.stringify(insertData, null, 2));

  const { data, error } = await supabase
    .from('recipes')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[recipes] save error:', error.message);
    console.error('[recipes] error details:', error.details);
    console.error('[recipes] error hint:', error.hint);
    console.error('[recipes] error code:', error.code);
    throw new Error(error.message);
  }

  // Detect silent RLS failure - insert was blocked but no error returned
  if (!data || !data.id) {
    console.error('[recipes] save failed: no data returned (likely RLS policy issue)');
    throw new Error('Failed to save recipe. Please check your account permissions.');
  }

  console.log('[recipes] saved successfully:', data.id);
  return data as Recipe;
}

/**
 * Get all recipes for a user, ordered by most recent first
 */
export async function getRecipes(userId: string): Promise<Recipe[]> {
  console.log('[recipes] fetching recipes for user:', userId);

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[recipes] fetch error:', error.message);
    console.error('[recipes] error code:', error.code);
    throw new Error(error.message);
  }

  console.log('[recipes] fetched', data?.length ?? 0, 'recipes');
  return (data ?? []) as Recipe[];
}

/**
 * Get a single recipe by ID
 */
export async function getRecipe(id: string): Promise<Recipe | null> {
  console.log('[recipes] fetching recipe:', id);

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[recipes] recipe not found');
      return null;
    }
    console.error('[recipes] get error:', error.message);
    throw new Error(error.message);
  }

  console.log('[recipes] fetched recipe:', data?.title);
  return data as Recipe;
}

/**
 * Delete a recipe by ID
 */
export async function deleteRecipe(id: string): Promise<void> {
  console.log('[recipes] deleting recipe:', id);

  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[recipes] delete error:', error.message);
    throw new Error(error.message);
  }

  console.log('[recipes] deleted successfully');
}

/**
 * Update a recipe
 */
export async function updateRecipe(
  id: string,
  updates: Partial<SaveRecipeInput>
): Promise<Recipe> {
  console.log('[recipes] updating recipe:', id);

  const { data, error } = await supabase
    .from('recipes')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[recipes] update error:', error.message);
    throw new Error(error.message);
  }

  console.log('[recipes] updated successfully');
  return data as Recipe;
}
