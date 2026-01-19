import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useMacroTracking } from './macro-tracking-state';
import { useAuth } from './auth';
import { fetchSavedRecipes, type SavedRecipeSummary } from '@/lib/recipe-library';

type AddMacroModalProps = {
  visible: boolean;
  onClose: () => void;
};

type TabType = 'manual' | 'recipe';

function formatMacros(macros?: SavedRecipeSummary['macros']) {
  if (!macros) return 'No macros';
  const parts: string[] = [];
  if (macros.calories != null) parts.push(`${macros.calories} cal`);
  if (macros.protein != null) parts.push(`P${macros.protein}`);
  if (macros.carbs != null) parts.push(`C${macros.carbs}`);
  if (macros.fat != null) parts.push(`F${macros.fat}`);
  return parts.length ? parts.join(' · ') : 'No macros';
}

export function AddMacroModal({ visible, onClose }: AddMacroModalProps) {
  const { addEntry } = useMacroTracking();
  const { user, loading: authLoading } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('manual');

  // Manual entry state
  const [label, setLabel] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  // Recipe tab state
  const [recipes, setRecipes] = useState<SavedRecipeSummary[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipeSummary | null>(null);
  const [servings, setServings] = useState(1);
  const [fetchKey, setFetchKey] = useState(0);

  const [saving, setSaving] = useState(false);

  // Bump fetch key when switching to recipe tab to force refetch
  useEffect(() => {
    if (activeTab === 'recipe') {
      setFetchKey((prev) => prev + 1);
    }
  }, [activeTab]);

  // Load recipes when recipe tab is active
  useEffect(() => {
    if (!visible || activeTab !== 'recipe') return;

    // If auth is still loading, show loading state
    if (authLoading) {
      setLoadingRecipes(true);
      return;
    }

    // If no user after auth loaded, show empty
    if (!user?.id) {
      setLoadingRecipes(false);
      setRecipes([]);
      return;
    }

    // Fetch recipes
    setLoadingRecipes(true);
    fetchSavedRecipes(user.id)
      .then((data) => {
        // Filter to only recipes with macro data
        const withMacros = data.filter(
          (r) => r.macros?.calories != null || r.macros?.protein != null
        );
        setRecipes(withMacros);
      })
      .catch((err) => {
        console.warn('[AddMacroModal] Failed to load recipes:', err);
        setRecipes([]);
      })
      .finally(() => setLoadingRecipes(false));
  }, [visible, activeTab, user?.id, authLoading, fetchKey]);

  const resetForm = () => {
    setLabel('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setSelectedRecipe(null);
    setServings(1);
  };

  const handleAddManual = async () => {
    setSaving(true);
    try {
      await addEntry({
        label: label.trim() || 'Food entry',
        calories: parseFloat(calories) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
      });
      resetForm();
      onClose();
    } catch (err) {
      console.warn('[AddMacroModal] Failed to add entry:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecipe = async () => {
    if (!selectedRecipe?.macros) return;

    setSaving(true);
    try {
      const macros = selectedRecipe.macros;
      await addEntry({
        label: selectedRecipe.title,
        calories: Math.round((macros.calories ?? 0) * servings),
        protein: Math.round((macros.protein ?? 0) * servings),
        carbs: Math.round((macros.carbs ?? 0) * servings),
        fat: Math.round((macros.fat ?? 0) * servings),
        recipeId: selectedRecipe.id,
        servings,
      });
      resetForm();
      onClose();
    } catch (err) {
      console.warn('[AddMacroModal] Failed to add recipe:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const adjustServings = (delta: number) => {
    setServings((prev) => Math.max(0.5, Math.round((prev + delta) * 2) / 2));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleCancel} />
        <View style={styles.sheet} lightColor="#FFFFFF" darkColor="#1F2937">
          <View style={styles.handle} lightColor="#D1D5DB" darkColor="#4B5563" />

          <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Add Food Entry</Text>

            {/* Tab Selector */}
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tab, activeTab === 'manual' && styles.tabActive]}
                onPress={() => setActiveTab('manual')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'manual' && styles.tabTextActive,
                  ]}
                >
                  Manual
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'recipe' && styles.tabActive]}
                onPress={() => setActiveTab('recipe')}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'recipe' && styles.tabTextActive,
                  ]}
                >
                  From Recipe
                </Text>
              </Pressable>
            </View>

            {activeTab === 'manual' ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Label (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={label}
                    onChangeText={setLabel}
                    placeholder="e.g., Breakfast, Protein shake"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Calories</Text>
                  <TextInput
                    style={styles.input}
                    value={calories}
                    onChangeText={setCalories}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.flex1]}>
                    <Text style={styles.label}>Protein (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={protein}
                      onChangeText={setProtein}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.flex1]}>
                    <Text style={styles.label}>Carbs (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={carbs}
                      onChangeText={setCarbs}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.flex1]}>
                    <Text style={styles.label}>Fat (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={fat}
                      onChangeText={setFat}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.buttons}>
                  <Pressable style={styles.cancelButton} onPress={handleCancel}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.addButton, saving && styles.addButtonDisabled]}
                    onPress={handleAddManual}
                    disabled={saving}
                  >
                    <Text style={styles.addButtonText}>
                      {saving ? 'Adding...' : 'Add'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                {loadingRecipes ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator />
                    <Text style={styles.loadingText}>Loading recipes...</Text>
                  </View>
                ) : recipes.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      No saved recipes with macro data.
                    </Text>
                    <Text style={styles.emptySubtext}>
                      Save a recipe from the paste link flow first.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.sectionLabel}>Select a recipe:</Text>
                    {recipes.map((recipe) => (
                      <Pressable
                        key={recipe.id}
                        style={[
                          styles.recipeCard,
                          selectedRecipe?.id === recipe.id && styles.recipeCardSelected,
                        ]}
                        onPress={() => setSelectedRecipe(recipe)}
                      >
                        <Text style={styles.recipeTitle}>{recipe.title}</Text>
                        <Text style={styles.recipeMacros}>
                          {formatMacros(recipe.macros)}
                        </Text>
                      </Pressable>
                    ))}

                    {selectedRecipe && (
                      <View style={styles.servingsRow}>
                        <Text style={styles.servingsLabel}>Servings:</Text>
                        <View style={styles.servingsControls}>
                          <Pressable
                            style={styles.servingsButton}
                            onPress={() => adjustServings(-0.5)}
                          >
                            <Text style={styles.servingsButtonText}>−</Text>
                          </Pressable>
                          <Text style={styles.servingsValue}>{servings}</Text>
                          <Pressable
                            style={styles.servingsButton}
                            onPress={() => adjustServings(0.5)}
                          >
                            <Text style={styles.servingsButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {selectedRecipe && (
                      <View style={styles.previewCard}>
                        <Text style={styles.previewTitle}>Will log:</Text>
                        <Text style={styles.previewMacros}>
                          {Math.round((selectedRecipe.macros?.calories ?? 0) * servings)} cal ·{' '}
                          P{Math.round((selectedRecipe.macros?.protein ?? 0) * servings)} ·{' '}
                          C{Math.round((selectedRecipe.macros?.carbs ?? 0) * servings)} ·{' '}
                          F{Math.round((selectedRecipe.macros?.fat ?? 0) * servings)}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                <View style={styles.buttons}>
                  <Pressable style={styles.cancelButton} onPress={handleCancel}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.addButton,
                      (!selectedRecipe || saving) && styles.addButtonDisabled,
                    ]}
                    onPress={handleAddRecipe}
                    disabled={!selectedRecipe || saving}
                  >
                    <Text style={styles.addButtonText}>
                      {saving ? 'Adding...' : 'Add'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  scrollContent: {
    flexGrow: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  addButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    opacity: 0.6,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    opacity: 0.8,
  },
  recipeCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  recipeCardSelected: {
    borderColor: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  recipeMacros: {
    fontSize: 13,
    opacity: 0.6,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  servingsLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  servingsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  servingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
  },
  servingsValue: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  previewCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#166534',
    marginBottom: 4,
  },
  previewMacros: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
});
