import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { getRecipe, deleteRecipe, type Recipe } from '@/services/recipes';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = React.useState<Recipe | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;

    getRecipe(id)
      .then((data) => {
        setRecipe(data);
      })
      .catch((err) => {
        console.error('[recipe] Failed to fetch:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setDeleting(true);
            try {
              await deleteRecipe(id);
              router.back();
            } catch (err) {
              console.error('[recipe] Failed to delete:', err);
              Alert.alert('Error', 'Failed to delete recipe');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Recipe not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </Pressable>
        </View>

        {/* Title & Badge */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.goal_type ? (
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>
                {recipe.goal_type.replace('_', ' ')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Meta */}
        <Text style={styles.meta}>
          {recipe.servings} servings · {recipe.ingredients?.length ?? 0} ingredients
        </Text>

        {/* Macros */}
        <View style={styles.macroCard}>
          <Text style={styles.macroTitle}>Nutrition per serving</Text>
          <View style={styles.macroGrid}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{recipe.macros?.calories ?? '?'}</Text>
              <Text style={styles.macroLabel}>cal</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{recipe.macros?.protein ?? '?'}g</Text>
              <Text style={styles.macroLabel}>protein</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{recipe.macros?.carbs ?? '?'}g</Text>
              <Text style={styles.macroLabel}>carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{recipe.macros?.fat ?? '?'}g</Text>
              <Text style={styles.macroLabel}>fat</Text>
            </View>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {recipe.ingredients?.map((item, idx) => (
            <View key={`ing-${idx}`} style={styles.listRow}>
              <View style={styles.bullet} />
              <Text style={styles.listText}>
                {item.quantity ? `${item.quantity} ` : ''}
                {item.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {recipe.steps?.map((step, idx) => (
            <View key={`step-${idx}`} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{idx + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Assumptions */}
        {recipe.assumptions?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assumptions</Text>
            {recipe.assumptions.map((assumption, idx) => (
              <View key={`assumption-${idx}`} style={styles.listRow}>
                <View style={styles.bullet} />
                <Text style={styles.assumptionText}>{assumption}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Source */}
        {recipe.source_url ? (
          <View style={styles.section}>
            <Text style={styles.sourceLabel}>Source</Text>
            <Text style={styles.sourceUrl} numberOfLines={1}>
              {recipe.source_url}
            </Text>
          </View>
        ) : null}

        {/* Delete Button */}
        <Pressable
          style={[styles.deleteButton, deleting && styles.deleteDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete Recipe</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingVertical: 16,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  goalBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  goalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    textTransform: 'capitalize',
  },
  meta: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  macroCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  macroTitle: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
    marginBottom: 12,
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  macroLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4B5563',
    marginTop: 6,
  },
  listText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  assumptionText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    opacity: 0.7,
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#111827',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  sourceLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
  },
  sourceUrl: {
    fontSize: 13,
    color: '#059669',
  },
  errorText: {
    fontSize: 16,
    opacity: 0.6,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  deleteDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
});
