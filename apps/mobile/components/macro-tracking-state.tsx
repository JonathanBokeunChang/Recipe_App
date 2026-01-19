import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/supabaseClient';
import { useAuth } from './auth';

export type MacroEntry = {
  id: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
  recipeId?: string;
  servings?: number;
};

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type DailyMacros = {
  date: string;
  entries: MacroEntry[];
  totals: MacroTotals;
};

type MacroTrackingContextValue = {
  today: DailyMacros;
  loading: boolean;
  addEntry: (entry: Omit<MacroEntry, 'id' | 'createdAt'>) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  clearToday: () => Promise<void>;
};

function getLocalDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateTotals(entries: MacroEntry[]): MacroTotals {
  return entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + (entry.calories || 0),
      protein: acc.protein + (entry.protein || 0),
      carbs: acc.carbs + (entry.carbs || 0),
      fat: acc.fat + (entry.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

const emptyDay = (date: string): DailyMacros => ({
  date,
  entries: [],
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});

const MacroTrackingContext = createContext<MacroTrackingContextValue | undefined>(undefined);

export function MacroTrackingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [today, setToday] = useState<DailyMacros>(() => emptyDay(getLocalDateString()));
  const [loading, setLoading] = useState(true);

  const loadToday = useCallback(async () => {
    const dateStr = getLocalDateString();

    if (!user?.id) {
      setToday(emptyDay(dateStr));
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('daily_macro_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .maybeSingle();

      if (error) {
        console.warn('[MacroTracking] Failed to load from Supabase:', error);
        setToday(emptyDay(dateStr));
      } else if (data) {
        setToday({
          date: dateStr,
          entries: (data.entries as MacroEntry[]) ?? [],
          totals: {
            calories: data.total_calories ?? 0,
            protein: data.total_protein ?? 0,
            carbs: data.total_carbs ?? 0,
            fat: data.total_fat ?? 0,
          },
        });
      } else {
        setToday(emptyDay(dateStr));
      }
    } catch (err) {
      console.warn('[MacroTracking] Exception loading today:', err);
      setToday(emptyDay(dateStr));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const saveToday = useCallback(
    async (data: DailyMacros) => {
      if (!user?.id) return;

      try {
        const { error } = await supabase.from('daily_macro_logs').upsert({
          user_id: user.id,
          date: data.date,
          entries: data.entries,
          total_calories: Math.round(data.totals.calories),
          total_protein: data.totals.protein,
          total_carbs: data.totals.carbs,
          total_fat: data.totals.fat,
          updated_at: new Date().toISOString(),
        });

        if (error) {
          console.warn('[MacroTracking] Failed to save to Supabase:', error);
        }
      } catch (err) {
        console.warn('[MacroTracking] Exception saving:', err);
      }
    },
    [user?.id]
  );

  // Load when user changes or on mount
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // Check for day change periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const currentDate = getLocalDateString();
      if (currentDate !== today.date) {
        loadToday();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [today.date, loadToday]);

  const addEntry = useCallback(
    async (entry: Omit<MacroEntry, 'id' | 'createdAt'>) => {
      const newEntry: MacroEntry = {
        ...entry,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };

      const newEntries = [...today.entries, newEntry];
      const newTotals = calculateTotals(newEntries);
      const newToday: DailyMacros = {
        ...today,
        entries: newEntries,
        totals: newTotals,
      };

      setToday(newToday);
      await saveToday(newToday);
    },
    [today, saveToday]
  );

  const removeEntry = useCallback(
    async (id: string) => {
      const newEntries = today.entries.filter((e) => e.id !== id);
      const newTotals = calculateTotals(newEntries);
      const newToday: DailyMacros = {
        ...today,
        entries: newEntries,
        totals: newTotals,
      };

      setToday(newToday);
      await saveToday(newToday);
    },
    [today, saveToday]
  );

  const clearToday = useCallback(async () => {
    const cleared = emptyDay(today.date);
    setToday(cleared);
    await saveToday(cleared);
  }, [today.date, saveToday]);

  const value = useMemo(
    () => ({
      today,
      loading,
      addEntry,
      removeEntry,
      clearToday,
    }),
    [today, loading, addEntry, removeEntry, clearToday]
  );

  return (
    <MacroTrackingContext.Provider value={value}>
      {children}
    </MacroTrackingContext.Provider>
  );
}

export function useMacroTracking() {
  const ctx = useContext(MacroTrackingContext);
  if (!ctx) {
    throw new Error('useMacroTracking must be used within MacroTrackingProvider');
  }
  return ctx;
}
