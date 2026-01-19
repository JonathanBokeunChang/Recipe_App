import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/components/auth';
import {
  fetchRecipeDocument,
  fetchSavedRecipes,
  type RecipeDocument,
  type SavedRecipeSummary,
} from '@/lib/recipe-library';
import { useRecipeLibrary } from '@/lib/recipe-library-context';

const log = (...args: any[]) => console.log('[Library]', ...args);

function formatDate(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString();
}

function formatMacros(macros?: SavedRecipeSummary['macros']) {
  if (!macros) return 'Macros pending';
  const parts: string[] = [];
  if (macros.calories != null) parts.push(`${macros.calories} cal`);
  if (macros.protein != null) parts.push(`P${macros.protein}`);
  if (macros.carbs != null) parts.push(`C${macros.carbs}`);
  if (macros.fat != null) parts.push(`F${macros.fat}`);
  return parts.length ? parts.join(' · ') : 'Macros pending';
}

export default function TabTwoScreen() {
  const { user } = useAuth();
  const { refreshKey } = useRecipeLibrary();
  const [recipes, setRecipes] = React.useState<SavedRecipeSummary[]>([]);
  const [selected, setSelected] = React.useState<SavedRecipeSummary | null>(null);
  const [selectedDoc, setSelectedDoc] = React.useState<RecipeDocument | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadRecipes = React.useCallback(async () => {
    log('========== LOAD RECIPES START ==========');
    log('loadRecipes called, user?.id =', user?.id);

    if (!user?.id) {
      log('No user.id, skipping fetch');
      return;
    }

    setLoading(true);
    setError(null);
    log('Set loading=true, fetching recipes...');

    try {
      const startTime = Date.now();
      const data = await fetchSavedRecipes(user.id);
      const duration = Date.now() - startTime;

      log('Fetch completed in', duration, 'ms');
      log('Fetched', data.length, 'recipes');
      if (data.length > 0) {
        log('First recipe:', data[0]);
      }

      setRecipes(data);
      log('Recipes state updated');
    } catch (err: any) {
      log('Fetch FAILED:', err?.message);
      console.error('[Library] Full error:', err);
      setError(err?.message || 'Failed to load saved recipes');
    } finally {
      setLoading(false);
      log('========== LOAD RECIPES COMPLETE ==========');
    }
  }, [user?.id]);

  const loadRecipeDetail = React.useCallback(async (row: SavedRecipeSummary) => {
    log('========== LOAD RECIPE DETAIL START ==========');
    log('loadRecipeDetail called for recipe:', row.id, row.title);

    if (!user?.id) {
      log('No user.id, skipping detail fetch');
      return;
    }

    setSelected(row);
    setSelectedDoc(null);
    setDetailLoading(true);
    setError(null);

    try {
      const startTime = Date.now();
      const doc = await fetchRecipeDocument(row.id, user.id);
      const duration = Date.now() - startTime;

      log('Document fetched in', duration, 'ms');
      log('Document:', doc ? { title: doc.title, goalType: doc.goalType, createdAt: doc.createdAt } : null);

      setSelectedDoc(doc);
    } catch (err: any) {
      log('Fetch FAILED:', err?.message);
      console.error('[Library] Full error:', err);
      setError(err?.message || 'Failed to load recipe');
    } finally {
      setDetailLoading(false);
      log('========== LOAD RECIPE DETAIL COMPLETE ==========');
    }
  }, [user?.id]);

  React.useEffect(() => {
    log('Library useEffect triggered, calling loadRecipes (refreshKey:', refreshKey, ')');
    loadRecipes();
  }, [loadRecipes, refreshKey]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRecipes} />}
    >
      <Text style={styles.title}>Library</Text>
      <Text style={styles.subtitle}>
        Saved recipes and goal-driven variants live in Supabase Storage and stay linked to
        your account.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!loading && !recipes.length ? (
        <View style={styles.emptyCard} lightColor="#FFFFFF" darkColor="#0B0F19">
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptyBody}>
            Save a recipe from the Paste Link flow to see it here.
          </Text>
        </View>
      ) : null}

      {recipes.map((recipe) => (
        <Pressable
          key={recipe.id}
          style={[
            styles.recipeCard,
            selected?.id === recipe.id && styles.recipeCardActive,
          ]}
          onPress={() => loadRecipeDetail(recipe)}
        >
          <View style={styles.recipeHeader}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {recipe.goalType ? recipe.goalType.replace('_', ' ') : 'Original'}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(recipe.createdAt)}</Text>
          </View>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          <Text style={styles.metaText}>{formatMacros(recipe.macros)}</Text>
          {recipe.sourceUrl || recipe.videoUrl ? (
            <Text style={styles.metaText}>{recipe.sourceUrl ?? recipe.videoUrl}</Text>
          ) : null}
        </Pressable>
      ))}

      {detailLoading ? (
        <View style={styles.detailCard} lightColor="#FFFFFF" darkColor="#0B0F19">
          <ActivityIndicator />
          <Text style={styles.metaText}>Loading recipe…</Text>
        </View>
      ) : null}

      {selected && selectedDoc ? (
        <View style={styles.detailCard} lightColor="#FFFFFF" darkColor="#0B0F19">
          <Text style={styles.detailTitle}>{selectedDoc.title ?? selected.title}</Text>
          <Text style={styles.metaText}>
            {selectedDoc.goalType ? selectedDoc.goalType.replace('_', ' ') : 'Original'}
            {selectedDoc.sourceUrl ? ` · ${selectedDoc.sourceUrl}` : ''}
          </Text>
          <Text style={styles.metaText}>
            {selectedDoc.modifiedRecipe?.ingredients?.length ??
              selectedDoc.originalRecipe?.ingredients?.length ??
              0}{' '}
            ingredients ·{' '}
            {selectedDoc.modifiedRecipe?.steps?.length ??
              selectedDoc.originalRecipe?.steps?.length ??
              0}{' '}
            steps
          </Text>
          {(selectedDoc.modifiedRecipe?.assumptions ?? selectedDoc.originalRecipe?.assumptions)?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              {(selectedDoc.modifiedRecipe?.assumptions ??
                selectedDoc.originalRecipe?.assumptions ??
                []
              ).map((item: string, idx: number) => (
                <Text key={`assumption-${idx}`} style={styles.assumptionText}>
                  • {item}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
  },
  recipeCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  recipeCardActive: {
    borderColor: '#111827',
    backgroundColor: '#F9FAFB',
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 12,
    opacity: 0.6,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 13,
    opacity: 0.75,
  },
  detailCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  section: {
    marginTop: 6,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  assumptionText: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
});
