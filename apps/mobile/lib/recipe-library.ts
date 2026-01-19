import type { GoalType } from '@/components/auth';
import { supabase } from '@/supabaseClient';

// Verbose debug logging for recipe saving
const DEBUG = true;
const log = (...args: any[]) => {
  if (DEBUG) console.log('[recipe-library]', ...args);
};
const logError = (...args: any[]) => {
  console.error('[recipe-library] ERROR:', ...args);
};
const logWarn = (...args: any[]) => {
  console.warn('[recipe-library] WARN:', ...args);
};

const TABLE_NAME = 'user_recipes';

type MacroSummary = {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
};

export type SavedRecipeSummary = {
  id: string;
  title: string;
  goalType?: GoalType | null;
  sourceUrl?: string | null;
  videoUrl?: string | null;
  macros?: MacroSummary | null;
  hasModified: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type RecipeDocument = {
  id: string;
  userId: string;
  title: string;
  sourceUrl?: string | null;
  videoUrl?: string | null;
  goalType?: GoalType | null;
  macros?: MacroSummary | null;
  originalRecipe: any;
  modifiedRecipe?: any;
  hasModified: boolean;
  createdAt: string;
  updatedAt?: string;
};

function summarizeMacros(input: any): MacroSummary | null {
  log('summarizeMacros: received', input ? 'value' : 'null/undefined');
  if (!input || typeof input !== 'object') {
    return null;
  }

  const source =
    input.summary?.newMacros ??
    input.macros ??
    input.modifiedRecipe?.macros ??
    input.summary?.macros ??
    input.summary;

  if (!source || typeof source !== 'object') {
    return null;
  }

  const toNumber = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const calories = toNumber((source as any).calories);
  const protein = toNumber((source as any).protein ?? (source as any).protein_g);
  const carbs = toNumber((source as any).carbs ?? (source as any).carbs_g);
  const fat = toNumber((source as any).fat ?? (source as any).fat_g);

  if ([calories, protein, carbs, fat].every((val) => val == null)) {
    return null;
  }

  return { calories, protein, carbs, fat };
}

function mapSummaryRow(row: any): SavedRecipeSummary {
  return {
    id: row.id,
    title: row.title ?? 'Untitled recipe',
    goalType: row.goal_type ?? null,
    sourceUrl: row.source_url ?? row.video_url ?? null,
    videoUrl: row.video_url ?? null,
    macros: row.macro_summary ?? summarizeMacros(row.modified_recipe ?? row.original_recipe),
    hasModified: !!(row.has_modified ?? row.modified_recipe),
    createdAt: row.created_at,
    updatedAt: (row as any).updated_at ?? row.created_at,
  };
}

export async function saveRecipeToLibrary(params: {
  userId: string;
  title?: string | null;
  sourceUrl?: string | null;
  videoUrl?: string | null;
  goalType?: GoalType | null;
  originalRecipe: any;
  modifiedRecipe?: any;
}): Promise<SavedRecipeSummary> {
  log('========== SAVE RECIPE START ==========');
  log('saveRecipeToLibrary params:', {
    userId: params.userId,
    title: params.title,
    sourceUrl: params.sourceUrl,
    videoUrl: params.videoUrl,
    goalType: params.goalType,
    hasOriginalRecipe: !!params.originalRecipe,
    hasModifiedRecipe: !!params.modifiedRecipe,
  });

  // Check current auth session state before attempting save
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  log('Current auth session state:', {
    hasSession: !!sessionData?.session,
    sessionUserId: sessionData?.session?.user?.id,
    matchesProvidedUserId: sessionData?.session?.user?.id === params.userId,
    sessionError: sessionError?.message,
    accessTokenPresent: !!sessionData?.session?.access_token,
    accessTokenExpiry: sessionData?.session?.expires_at
      ? new Date(sessionData.session.expires_at * 1000).toISOString()
      : 'N/A',
  });

  if (!sessionData?.session) {
    logError('No active Supabase session - user may need to re-authenticate');
    throw new Error('Not authenticated. Please sign in again.');
  }

  if (sessionData.session.user.id !== params.userId) {
    logWarn('Session user ID does not match provided userId', {
      sessionUserId: sessionData.session.user.id,
      providedUserId: params.userId,
    });
  }

  const { userId, title, sourceUrl, videoUrl, goalType, originalRecipe, modifiedRecipe } = params;

  if (!userId) {
    logError('User ID missing');
    throw new Error('User ID is required to save a recipe');
  }
  if (!originalRecipe) {
    logError('Original recipe missing');
    throw new Error('Original recipe payload missing');
  }

  const payloadTitle = title ?? (modifiedRecipe as any)?.title ?? (originalRecipe as any)?.title ?? 'Untitled recipe';
  const macroSummary = summarizeMacros(modifiedRecipe ?? originalRecipe);
  const originalKeyCount =
    originalRecipe && typeof originalRecipe === 'object' ? Object.keys(originalRecipe).length : 0;
  const modifiedKeyCount =
    modifiedRecipe && typeof modifiedRecipe === 'object' ? Object.keys(modifiedRecipe).length : 0;

  const dbPayload = {
    user_id: userId,
    title: payloadTitle,
    source_url: sourceUrl ?? videoUrl ?? null,
    video_url: videoUrl ?? sourceUrl ?? null,
    goal_type: goalType ?? (modifiedRecipe as any)?.goalType ?? null,
    macro_summary: macroSummary,
    original_recipe: originalRecipe,
    modified_recipe: modifiedRecipe ?? null,
    has_modified: !!modifiedRecipe,
  };

  log('Prepared payload for insert:', {
    ...dbPayload,
    original_recipe: `[omitted ${originalKeyCount} keys]`,
    modified_recipe: modifiedRecipe ? `[omitted ${modifiedKeyCount} keys]` : null,
  });

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(dbPayload)
    .select('id,title,goal_type,source_url,video_url,macro_summary,has_modified,created_at,updated_at')
    .maybeSingle();

  if (error) {
    logError('Database insert FAILED:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    if (error.code === '42P01') {
      throw new Error(`The ${TABLE_NAME} table does not exist. Please set up the database schema in Supabase.`);
    }
    if (error.code === '42501' || error.message.includes('row-level security')) {
      throw new Error('Permission denied. Check Row Level Security policies in Supabase.');
    }
    throw new Error(`Failed to save recipe: ${error.message}`);
  }

  if (!data) {
    throw new Error('Unable to save recipe. No data returned from Supabase.');
  }

  const result = mapSummaryRow(data);
  log('Save SUCCESS:', result);
  log('========== SAVE RECIPE COMPLETE ==========');
  return result;
}

export async function fetchSavedRecipes(userId: string): Promise<SavedRecipeSummary[]> {
  log('========== FETCH SAVED RECIPES START ==========');
  log('fetchSavedRecipes called with userId:', userId);

  if (!userId) {
    logWarn('No userId provided, returning empty array');
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id,title,goal_type,source_url,video_url,macro_summary,has_modified,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logError('Fetch FAILED:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      fullError: JSON.stringify(error, null, 2),
    });

    if (error.code === '42P01') {
      throw new Error(`The ${TABLE_NAME} table does not exist. Please set up the database schema in Supabase.`);
    }
    if (error.code === 'PGRST301') {
      throw new Error('Permission denied. Please check Row Level Security policies in Supabase.');
    }
    throw new Error(`Failed to load recipes: ${error.message}`);
  }

  const result = data?.map(mapSummaryRow) ?? [];
  log('Fetch SUCCESS! Found', result.length, 'recipes');
  log('========== FETCH SAVED RECIPES COMPLETE ==========');
  return result;
}

export async function fetchRecipeDocument(
  recipeId: string,
  userId: string,
): Promise<RecipeDocument | null> {
  log('========== FETCH RECIPE DOCUMENT START ==========');
  log('fetchRecipeDocument called with recipeId:', recipeId, 'userId:', userId);

  if (!recipeId || !userId) {
    logWarn('Missing recipeId or userId, returning null');
    return null;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      'id,user_id,title,source_url,video_url,goal_type,macro_summary,original_recipe,modified_recipe,has_modified,created_at,updated_at',
    )
    .eq('id', recipeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logError('Fetch FAILED:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    if (error.code === '42P01') {
      throw new Error(`The ${TABLE_NAME} table does not exist. Please set up the database schema in Supabase.`);
    }
    if (error.code === 'PGRST301' || error.message.includes('row-level security')) {
      throw new Error('Permission denied. Please check Row Level Security policies in Supabase.');
    }
    throw new Error(`Failed to load recipe: ${error.message}`);
  }

  if (!data) {
    logWarn('No recipe found for id', recipeId);
    return null;
  }

  const document: RecipeDocument = {
    id: data.id,
    userId: (data as any).user_id,
    title: data.title ?? 'Untitled recipe',
    sourceUrl: (data as any).source_url ?? (data as any).video_url ?? null,
    videoUrl: (data as any).video_url ?? null,
    goalType: (data as any).goal_type ?? null,
    macros: (data as any).macro_summary ?? summarizeMacros((data as any).modified_recipe ?? (data as any).original_recipe),
    originalRecipe: (data as any).original_recipe,
    modifiedRecipe: (data as any).modified_recipe ?? undefined,
    hasModified: !!((data as any).has_modified ?? (data as any).modified_recipe),
    createdAt: (data as any).created_at,
    updatedAt: (data as any).updated_at ?? (data as any).created_at,
  };

  log('Fetch SUCCESS for recipe', recipeId);
  log('========== FETCH RECIPE DOCUMENT COMPLETE ==========');
  return document;
}
