import React from 'react';

type RecipeLibraryContextType = {
  /** Increments to trigger a refresh in Library tab */
  refreshKey: number;
  /** Call this after saving a recipe to trigger refresh in Library */
  triggerRefresh: () => void;
};

const RecipeLibraryContext = React.createContext<RecipeLibraryContextType | null>(null);

export function RecipeLibraryProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = React.useState(0);

  const triggerRefresh = React.useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const value = React.useMemo(() => ({ refreshKey, triggerRefresh }), [refreshKey, triggerRefresh]);

  return (
    <RecipeLibraryContext.Provider value={value}>
      {children}
    </RecipeLibraryContext.Provider>
  );
}

export function useRecipeLibrary() {
  const ctx = React.useContext(RecipeLibraryContext);
  if (!ctx) {
    throw new Error('useRecipeLibrary must be used within RecipeLibraryProvider');
  }
  return ctx;
}
