import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/components/auth';
import { getRecipes, type Recipe } from '@/services/recipes';

export default function LibraryScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchRecipes = React.useCallback(async () => {
    console.log('[library] fetchRecipes called, user:', user?.id, 'kind:', user?.kind);

    if (!user?.id || user.kind === 'guest') {
      console.log('[library] no user or guest, clearing recipes');
      setRecipes([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);

    try {
      console.log('[library] fetching recipes...');
      const data = await getRecipes(user.id);
      console.log('[library] got recipes:', data.length);
      setRecipes(data);
    } catch (err: any) {
      console.error('[library] Failed to fetch recipes:', err);
      setError(err.message || 'Failed to load recipes');
      setRecipes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.kind]);

  // Fetch on focus (when tab becomes active)
  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading && user?.id && user.kind !== 'guest') {
        setLoading(true);
        fetchRecipes();
      }
    }, [authLoading, user?.id, user?.kind, fetchRecipes])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecipes();
  };

  const renderRecipeCard = ({ item }: { item: Recipe }) => (
    <Pressable
      style={styles.recipeCard}
      onPress={() => router.push(`/recipe/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.recipeTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {item.goal_type ? (
          <View style={styles.goalBadge}>
            <Text style={styles.goalBadgeText}>
              {item.goal_type.replace('_', ' ')}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.recipeMeta}>
        {item.ingredients?.length ?? 0} ingredients · {item.steps?.length ?? 0} steps
      </Text>
      <View style={styles.macroRow}>
        <Text style={styles.macroText}>
          {item.macros?.calories ?? '?'} cal
        </Text>
        <Text style={styles.macroText}>
          P {item.macros?.protein ?? '?'}g
        </Text>
        <Text style={styles.macroText}>
          C {item.macros?.carbs ?? '?'}g
        </Text>
        <Text style={styles.macroText}>
          F {item.macros?.fat ?? '?'}g
        </Text>
      </View>
    </Pressable>
  );

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Guest or not signed in
  if (!user?.id || user.kind === 'guest') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.subtitle}>
          Sign in to save and view your recipes.
        </Text>
        <View style={styles.emptyCard} lightColor="#FFFFFF" darkColor="#0B0F19">
          <Text style={styles.emptyTitle}>Not signed in</Text>
          <Text style={styles.emptyBody}>
            Create an account or sign in to start building your recipe library.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Library</Text>
      <Text style={styles.subtitle}>
        {loading
          ? 'Loading recipes...'
          : recipes.length === 0
          ? 'Saved recipes will appear here.'
          : `${recipes.length} saved recipe${recipes.length !== 1 ? 's' : ''}`}
      </Text>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : recipes.length === 0 ? (
        <View style={styles.emptyCard} lightColor="#FFFFFF" darkColor="#0B0F19">
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptyBody}>
            Create your first recipe from a video, then save it to build your library.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          renderItem={renderRecipeCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.6,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
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
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  goalBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  goalBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
    textTransform: 'capitalize',
  },
  recipeMeta: {
    fontSize: 13,
    opacity: 0.7,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  macroText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
});
