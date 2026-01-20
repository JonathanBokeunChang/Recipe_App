import {
  saveRecipeToLibrary,
  fetchSavedRecipes,
  fetchRecipeDocument,
  deleteRecipeFromLibrary,
} from '../recipe-library';

// Get the mocked supabase client
const mockSupabase = (global as any).mockSupabaseClient;

// Mock recipe data
const mockOriginalRecipe = {
  title: 'Test Recipe',
  servings: 4,
  ingredients: [
    { name: 'chicken breast', quantity: '500g' },
    { name: 'olive oil', quantity: '2 tbsp' },
  ],
  steps: ['Preheat oven', 'Season chicken', 'Bake for 25 minutes'],
  macros: {
    calories: 450,
    protein: 45,
    carbs: 5,
    fat: 28,
  },
};

const mockModifiedRecipe = {
  ...mockOriginalRecipe,
  title: 'Test Recipe (Bulking)',
  ingredients: [
    { name: 'chicken breast', quantity: '600g' },
    { name: 'olive oil', quantity: '3 tbsp' },
    { name: 'rice', quantity: '200g' },
  ],
  macros: {
    calories: 750,
    protein: 55,
    carbs: 80,
    fat: 32,
  },
};

describe('Recipe Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveRecipeToLibrary', () => {
    it('should save recipe successfully when authenticated', async () => {
      const mockSession = {
        user: { id: 'user-123' },
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const mockInsertResult = {
        id: 'recipe-456',
        title: 'Test Recipe',
        goal_type: 'bulk',
        source_url: 'https://tiktok.com/video',
        video_url: 'https://tiktok.com/video',
        macro_summary: { calories: 450, protein: 45, carbs: 5, fat: 28 },
        has_modified: false,
        created_at: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockInsertResult,
          error: null,
        }),
      });

      const result = await saveRecipeToLibrary({
        userId: 'user-123',
        title: 'Test Recipe',
        sourceUrl: 'https://tiktok.com/video',
        videoUrl: 'https://tiktok.com/video',
        goalType: 'bulk',
        originalRecipe: mockOriginalRecipe,
      });

      expect(result.id).toBe('recipe-456');
      expect(result.title).toBe('Test Recipe');
      expect(result.hasModified).toBe(false);
    });

    it('should save recipe with modified version', async () => {
      const mockSession = {
        user: { id: 'user-123' },
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const mockInsertResult = {
        id: 'recipe-789',
        title: 'Test Recipe (Bulking)',
        goal_type: 'bulk',
        source_url: 'https://tiktok.com/video',
        video_url: 'https://tiktok.com/video',
        macro_summary: { calories: 750, protein: 55, carbs: 80, fat: 32 },
        has_modified: true,
        created_at: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockInsertResult,
          error: null,
        }),
      });

      const result = await saveRecipeToLibrary({
        userId: 'user-123',
        title: 'Test Recipe',
        sourceUrl: 'https://tiktok.com/video',
        goalType: 'bulk',
        originalRecipe: mockOriginalRecipe,
        modifiedRecipe: mockModifiedRecipe,
      });

      expect(result.id).toBe('recipe-789');
      expect(result.hasModified).toBe(true);
      expect(result.macros?.calories).toBe(750);
    });

    it('should throw error when not authenticated', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(
        saveRecipeToLibrary({
          userId: 'user-123',
          originalRecipe: mockOriginalRecipe,
        })
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw error when userId is missing', async () => {
      const mockSession = {
        user: { id: 'user-123' },
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      await expect(
        saveRecipeToLibrary({
          userId: '',
          originalRecipe: mockOriginalRecipe,
        })
      ).rejects.toThrow('User ID is required');
    });

    it('should throw error when originalRecipe is missing', async () => {
      const mockSession = {
        user: { id: 'user-123' },
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      await expect(
        saveRecipeToLibrary({
          userId: 'user-123',
          originalRecipe: null as any,
        })
      ).rejects.toThrow('Original recipe payload missing');
    });

    it('should handle RLS permission denied error', async () => {
      const mockSession = {
        user: { id: 'user-123' },
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '42501', message: 'row-level security violation' },
        }),
      });

      await expect(
        saveRecipeToLibrary({
          userId: 'user-123',
          originalRecipe: mockOriginalRecipe,
        })
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('fetchSavedRecipes', () => {
    it('should fetch recipes for a user', async () => {
      const mockRecipes = [
        {
          id: 'recipe-1',
          title: 'Recipe 1',
          goal_type: 'bulk',
          macro_summary: { calories: 500 },
          has_modified: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'recipe-2',
          title: 'Recipe 2',
          goal_type: 'cut',
          macro_summary: { calories: 300 },
          has_modified: false,
          created_at: new Date().toISOString(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockRecipes,
          error: null,
        }),
      });

      const result = await fetchSavedRecipes('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('recipe-1');
      expect(result[0].goalType).toBe('bulk');
      expect(result[1].goalType).toBe('cut');
    });

    it('should return empty array when no userId provided', async () => {
      const result = await fetchSavedRecipes('');
      expect(result).toEqual([]);
    });

    it('should handle fetch errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error', code: 'UNKNOWN' },
        }),
      });

      await expect(fetchSavedRecipes('user-123')).rejects.toThrow('Failed to load recipes');
    });
  });

  describe('fetchRecipeDocument', () => {
    it('should fetch full recipe document', async () => {
      const mockDoc = {
        id: 'recipe-123',
        user_id: 'user-123',
        title: 'Full Recipe',
        source_url: 'https://tiktok.com/video',
        video_url: 'https://tiktok.com/video',
        goal_type: 'lean_bulk',
        macro_summary: { calories: 600, protein: 50 },
        original_recipe: mockOriginalRecipe,
        modified_recipe: mockModifiedRecipe,
        has_modified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockDoc,
          error: null,
        }),
      });

      const result = await fetchRecipeDocument('recipe-123', 'user-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('recipe-123');
      expect(result?.title).toBe('Full Recipe');
      expect(result?.hasModified).toBe(true);
      expect(result?.originalRecipe).toEqual(mockOriginalRecipe);
      expect(result?.modifiedRecipe).toEqual(mockModifiedRecipe);
    });

    it('should return null for missing recipe', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      const result = await fetchRecipeDocument('nonexistent', 'user-123');
      expect(result).toBeNull();
    });

    it('should return null when recipeId or userId missing', async () => {
      const result1 = await fetchRecipeDocument('', 'user-123');
      expect(result1).toBeNull();

      const result2 = await fetchRecipeDocument('recipe-123', '');
      expect(result2).toBeNull();
    });
  });

  describe('deleteRecipeFromLibrary', () => {
    it('should delete recipe for the user', async () => {
      const finalEq = jest.fn().mockResolvedValue({ error: null });
      const firstEq = jest.fn().mockReturnValue({ eq: finalEq });
      const mockDelete = jest.fn().mockReturnValue({ eq: firstEq });

      mockSupabase.from.mockReturnValue({ delete: mockDelete });

      await expect(deleteRecipeFromLibrary('recipe-123', 'user-123')).resolves.not.toThrow();
      expect(mockSupabase.from).toHaveBeenCalledWith('user_recipes');
      expect(firstEq).toHaveBeenCalledWith('id', 'recipe-123');
      expect(finalEq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should throw when ids are missing', async () => {
      await expect(deleteRecipeFromLibrary('', 'user-123')).rejects.toThrow('required');
      await expect(deleteRecipeFromLibrary('recipe-123', '')).rejects.toThrow('required');
    });

    it('should surface database errors', async () => {
      const finalEq = jest.fn().mockResolvedValue({
        error: { message: 'Database error', code: 'UNKNOWN' },
      });
      const firstEq = jest.fn().mockReturnValue({ eq: finalEq });
      const mockDelete = jest.fn().mockReturnValue({ eq: firstEq });

      mockSupabase.from.mockReturnValue({ delete: mockDelete });

      await expect(deleteRecipeFromLibrary('recipe-123', 'user-123')).rejects.toThrow('Failed to delete recipe');
    });
  });
});
