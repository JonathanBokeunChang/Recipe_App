import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
  deleteRecipeFromLibrary,
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
  const { refreshKey, triggerRefresh } = useRecipeLibrary();
  const [recipes, setRecipes] = React.useState<SavedRecipeSummary[]>([]);
  const [selected, setSelected] = React.useState<SavedRecipeSummary | null>(null);
  const [selectedDoc, setSelectedDoc] = React.useState<RecipeDocument | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
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

  const formatMacroLine = React.useCallback((macros?: any) => {
    if (!macros || typeof macros !== 'object') return null;
    const toNumber = (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(num) : null;
    };
    const calories = toNumber(macros.calories ?? macros.kcal ?? macros.cal);
    const protein = toNumber(macros.protein ?? macros.protein_g);
    const carbs = toNumber(macros.carbs ?? macros.carbs_g);
    const fat = toNumber(macros.fat ?? macros.fat_g);
    const parts = [
      calories != null ? `${calories} cal` : null,
      protein != null ? `P${protein}` : null,
      carbs != null ? `C${carbs}` : null,
      fat != null ? `F${fat}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }, []);

  const extractMacros = React.useCallback((input: any) => {
    if (!input || typeof input !== 'object') return null;
    return (
      input.summary?.newMacros ??
      input.summary?.macros ??
      input.macros ??
      input.modifiedRecipe?.macros ??
      null
    );
  }, []);

  const renderIngredientSection = (ingredients?: any[], title = 'Ingredients') => {
    if (!ingredients?.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {ingredients.map((item: any, idx: number) => (
          <View key={`${title}-${idx}`} style={styles.listRow}>
            <View style={styles.bullet} />
            <Text style={styles.listText}>
              {item.quantity ? `${item.quantity} ` : ''}
              {item.unit ? `${item.unit} ` : ''}
              {item.name ?? item.ingredient ?? 'Ingredient'}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderStepSection = (steps?: any[], title = 'Steps') => {
    if (!steps?.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {steps.map((step: string, idx: number) => (
          <View key={`${title}-${idx}`} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{idx + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderNotesSection = (notes?: string[], title = 'Notes') => {
    if (!notes?.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {notes.map((note: string, idx: number) => (
          <View key={`${title}-${idx}`} style={styles.listRow}>
            <View style={styles.bullet} />
            <Text style={styles.listText}>{note}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderEquipmentSection = (equipment?: string[]) => {
    if (!equipment?.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Equipment</Text>
        <View style={styles.chipRow}>
          {equipment.map((item: string, idx: number) => (
            <View key={`equip-${idx}`} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

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

  const handleDelete = React.useCallback(() => {
    if (!selected || !user?.id) return;

    const runDelete = async () => {
      setDeleting(true);
      setError(null);
      try {
        await deleteRecipeFromLibrary(selected.id, user.id);
        setRecipes((prev) => prev.filter((r) => r.id !== selected.id));
        setSelected(null);
        setSelectedDoc(null);
        triggerRefresh();
      } catch (err: any) {
        console.error('[Library] Delete FAILED:', err);
        setError(err?.message || 'Failed to delete recipe');
      } finally {
        setDeleting(false);
      }
    };

    // Alert is flaky on web; use window.confirm there as a fallback
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' ? window.confirm('Delete this recipe from your library?') : true;
      if (ok) runDelete();
      return;
    }

    Alert.alert(
      'Delete recipe?',
      'This removes the recipe and any modifications from your library.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runDelete },
      ]
    );
  }, [selected, user?.id, triggerRefresh]);

  const originalRecipe = selectedDoc?.originalRecipe ?? null;
  const modifiedBundle = selectedDoc?.modifiedRecipe ?? null;
  const modifiedRecipe = modifiedBundle?.modifiedRecipe ?? modifiedBundle ?? null;
  const originalMacros = extractMacros(originalRecipe);
  const modifiedMacros = extractMacros(modifiedBundle);
  const comparisonOriginalMacros = modifiedBundle?.summary?.originalMacros ?? originalMacros;

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
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>{selectedDoc.title ?? selected.title}</Text>
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>
                {selectedDoc.goalType ? selectedDoc.goalType.replace('_', ' ') : 'Original'}
              </Text>
            </View>
          </View>
          <Text style={styles.metaText}>
            {formatDate(selectedDoc.createdAt)}
            {selectedDoc.sourceUrl ? ` · ${selectedDoc.sourceUrl}` : ''}
          </Text>

          {formatMacroLine(originalMacros) ? (
            <Text style={styles.metaText}>Original macros: {formatMacroLine(originalMacros)}</Text>
          ) : null}

          {modifiedMacros ? (
            <Text style={styles.metaText}>
              Modified macros: {formatMacroLine(modifiedMacros)}
              {comparisonOriginalMacros
                ? ` (was ${formatMacroLine(comparisonOriginalMacros) ?? '?'})`
                : ''}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {(modifiedRecipe?.ingredients?.length ?? originalRecipe?.ingredients?.length ?? 0)} ingredients ·{' '}
              {(modifiedRecipe?.steps?.length ?? originalRecipe?.steps?.length ?? 0)} steps
            </Text>
            {selectedDoc.videoUrl ? <Text style={styles.metaText}>{selectedDoc.videoUrl}</Text> : null}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.deleteButton, (deleting || detailLoading) && styles.primaryDisabled]}
              disabled={deleting || detailLoading}
              onPress={handleDelete}
            >
              <Text style={styles.deleteButtonText}>{deleting ? 'Deleting…' : 'Delete from library'}</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Original Recipe</Text>
          {formatMacroLine(originalMacros) ? (
            <Text style={styles.macroLine}>{formatMacroLine(originalMacros)}</Text>
          ) : null}
          {renderIngredientSection(originalRecipe?.ingredients)}
          {renderStepSection(originalRecipe?.steps)}
          {renderEquipmentSection((originalRecipe as any)?.equipment)}
          {renderNotesSection((originalRecipe as any)?.assumptions ?? (originalRecipe as any)?.notes)}

          {modifiedRecipe ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionHeader}>Modified Recipe</Text>
              {formatMacroLine(modifiedMacros) ? (
                <Text style={styles.macroLine}>{formatMacroLine(modifiedMacros)}</Text>
              ) : null}

              {modifiedBundle?.edits?.length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Changes Made</Text>
                  {modifiedBundle.edits.map((edit: any, idx: number) => (
                    <View key={`edit-${idx}`} style={styles.changeRow}>
                      <Text style={styles.changeType}>{edit.lever?.replace(/_/g, ' ') ?? 'Edit'}</Text>
                      <Text style={styles.changeDetail}>
                        {edit.original ? <Text style={styles.strikethrough}>{edit.original}</Text> : null}
                        {edit.modified ? ` → ${edit.modified}` : null}
                      </Text>
                      {edit.macroDelta ? (
                        <Text style={styles.macroDelta}>
                          {edit.macroDelta.calories
                            ? `${edit.macroDelta.calories > 0 ? '+' : ''}${edit.macroDelta.calories} cal `
                            : ''}
                          {edit.macroDelta.protein
                            ? `P${edit.macroDelta.protein > 0 ? '+' : ''}${edit.macroDelta.protein} `
                            : ''}
                          {edit.macroDelta.carbs
                            ? `C${edit.macroDelta.carbs > 0 ? '+' : ''}${edit.macroDelta.carbs} `
                            : ''}
                          {edit.macroDelta.fat
                            ? `F${edit.macroDelta.fat > 0 ? '+' : ''}${edit.macroDelta.fat}`
                            : ''}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {modifiedBundle?.analysis?.topMacroDrivers?.length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Top Macro Drivers</Text>
                  <View style={styles.chipRow}>
                    {modifiedBundle.analysis.topMacroDrivers.map((driver: any, idx: number) => (
                      <View key={`driver-${idx}`} style={styles.chip}>
                        <Text style={styles.chipText}>{driver.ingredient}</Text>
                        <Text style={styles.chipSubtext}>{driver.contribution}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {renderIngredientSection(modifiedRecipe?.ingredients, 'Modified Ingredients')}
              {renderStepSection(modifiedRecipe?.steps, 'Modified Steps')}
              {renderNotesSection(modifiedBundle?.warnings, 'Notes / Warnings')}
              {renderNotesSection((modifiedRecipe as any)?.assumptions ?? (modifiedRecipe as any)?.notes)}
              {renderEquipmentSection((modifiedRecipe as any)?.equipment)}

              {modifiedBundle?.stepUpdates?.length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Step Updates</Text>
                  {modifiedBundle.stepUpdates.map((update: any, idx: number) => (
                    <View key={`step-update-${idx}`} style={styles.stepUpdateCard}>
                      <Text style={styles.stepUpdateNumber}>Step {update.stepNumber}</Text>
                      <Text style={styles.stepUpdateText}>{update.modified}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
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
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  detailPillText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  actionRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  macroLine: {
    fontSize: 13,
    opacity: 0.8,
    marginTop: 2,
    marginBottom: 4,
  },
  section: {
    marginTop: 6,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  listRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bullet: {
    width: 6,
    height: 6,
    backgroundColor: '#111827',
    borderRadius: 999,
    marginTop: 7,
  },
  listText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 4,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#111827',
    color: '#F9FAFB',
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 22,
    fontSize: 12,
  },
  stepText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipSubtext: {
    fontSize: 11,
    opacity: 0.7,
  },
  changeRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  changeType: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  changeDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  macroDelta: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  stepUpdateCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    marginTop: 4,
  },
  stepUpdateNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepUpdateText: {
    fontSize: 13,
    lineHeight: 18,
  },
  assumptionText: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
});
