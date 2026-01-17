import type { GoalType } from '@/components/auth';
import { supabase } from '@/supabaseClient';

type MacroSummary = {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
};

export type SavedRecipeRow = {
  id: string;
  title: string;
  storagePath: string;
  videoUrl?: string | null;
  goalType?: GoalType | null;
  macros?: MacroSummary | null;
  createdAt: string;
};

export type RecipeDocument = {
  title?: string | null;
  sourceUrl?: string | null;
  originalRecipe: any;
  modifiedRecipe?: any;
  goalType?: GoalType | null;
  savedAt: string;
};

function summarizeMacros(input: any): MacroSummary | null {
  if (!input || typeof input !== 'object') return null;
  const source =
    input.summary?.newMacros ??
    input.macros ??
    input.modifiedRecipe?.macros ??
    input.summary?.macros;

  if (!source || typeof source !== 'object') return null;
  const toNumber = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const calories = toNumber(source.calories);
  const protein = toNumber(source.protein ?? source.protein_g);
  const carbs = toNumber(source.carbs ?? source.carbs_g);
  const fat = toNumber(source.fat ?? source.fat_g);

  if ([calories, protein, carbs, fat].every((val) => val == null)) {
    return null;
  }

  return { calories, protein, carbs, fat };
}

// Simple RFC4122 v4 generator to satisfy Supabase UUID column.
function makeId() {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  // Per RFC: time_hi_and_version top 4 bits = 0100, clock_seq_hi_and_reserved top 2 bits = 10
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const hex = Array.from(bytes, toHex).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

export async function saveRecipeToLibrary(params: {
  userId: string;
  title?: string | null;
  videoUrl?: string | null;
  goalType?: GoalType | null;
  originalRecipe: any;
  modifiedRecipe?: any;
}): Promise<SavedRecipeRow> {
  const { userId, title, videoUrl, goalType, originalRecipe, modifiedRecipe } = params;
  if (!userId) {
    throw new Error('User ID is required to save a recipe');
  }
  if (!originalRecipe) {
    throw new Error('Original recipe payload missing');
  }

  const id = makeId();
  const storagePath = `${userId}/${id}.json`;
  const savedAt = new Date().toISOString();
  const payload: RecipeDocument = {
    title: title ?? originalRecipe?.title ?? 'Untitled recipe',
    sourceUrl: videoUrl ?? null,
    originalRecipe,
    modifiedRecipe,
    goalType: goalType ?? modifiedRecipe?.goalType ?? null,
    savedAt,
  };
  const macroSummary = summarizeMacros(modifiedRecipe ?? originalRecipe);

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });

  const { error: uploadError } = await supabase.storage
    .from('recipes')
    .upload(storagePath, blob, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'application/json',
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from('saved_recipes')
    .upsert({
      id,
      user_id: userId,
      title: payload.title ?? 'Untitled recipe',
      goal_type: payload.goalType,
      video_url: videoUrl ?? null,
      storage_path: storagePath,
      macros: macroSummary,
      updated_at: savedAt,
    })
    .select('id,title,goal_type,video_url,storage_path,macros,created_at')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data?.id ?? id,
    title: data?.title ?? payload.title ?? 'Untitled recipe',
    goalType: (data as any)?.goal_type ?? payload.goalType ?? null,
    videoUrl: (data as any)?.video_url ?? videoUrl ?? null,
    storagePath: (data as any)?.storage_path ?? storagePath,
    macros: (data as any)?.macros ?? macroSummary,
    createdAt: (data as any)?.created_at ?? savedAt,
  };
}

export async function fetchSavedRecipes(userId: string): Promise<SavedRecipeRow[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('saved_recipes')
    .select('id,title,goal_type,video_url,storage_path,macros,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    data?.map((row) => ({
      id: row.id,
      title: row.title,
      goalType: (row as any).goal_type ?? null,
      videoUrl: (row as any).video_url ?? null,
      storagePath: (row as any).storage_path,
      macros: (row as any).macros ?? null,
      createdAt: (row as any).created_at,
    })) ?? []
  );
}

export async function fetchRecipeDocument(storagePath: string): Promise<RecipeDocument | null> {
  if (!storagePath) return null;

  const { data, error } = await supabase.storage.from('recipes').download(storagePath);
  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  // Use Response to normalize Blob/ArrayBuffer into text
  const text = await new Response(data as any).text();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn('[recipe-library] Failed to parse recipe document', err);
    return null;
  }
}
