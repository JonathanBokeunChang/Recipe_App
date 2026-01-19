import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { useAuth } from './auth';

type BiologicalSex = 'female' | 'male' | 'unspecified';
type GoalChoice = 'bulk' | 'lean_bulk' | 'cut' | 'maintain';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type DietStyle = 'none' | 'vegetarian' | 'vegan' | 'pescatarian';
type WeightUnit = 'kg' | 'lb';
type HeightUnit = 'cm' | 'imperial';

export type QuizState = {
  biologicalSex: BiologicalSex | null;
  age: number | null;
  heightCm: number | null;
  heightUnit: HeightUnit;
  heightFeet: number | null;
  heightInches: number | null;
  weightKg: number | null;
  weightUnit: WeightUnit;
  goalWeightKg: number | null;
  goal: GoalChoice | null;
  pace: number; // 1 (conservative) - 5 (aggressive)
  activityLevel: ActivityLevel | null;
  dietStyle: DietStyle;
  allergens: string[];
  avoidList: string;
};

type QuizStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

type QuizContextValue = {
  quiz: QuizState;
  status: QuizStatus;
  saving: boolean;
  updateQuiz: (partial: Partial<QuizState>) => void;
  completeQuiz: () => Promise<void>;
  skipQuiz: () => Promise<void>;
  resetQuiz: () => void;
};

const defaultState: QuizState = {
  biologicalSex: null,
  age: null,
  heightCm: null,
  heightUnit: 'cm',
  heightFeet: null,
  heightInches: null,
  weightKg: null,
  weightUnit: 'kg',
  goalWeightKg: null,
  goal: null,
  pace: 3,
  activityLevel: null,
  dietStyle: 'none',
  allergens: [],
  avoidList: '',
};

const QuizContext = createContext<QuizContextValue | undefined>(undefined);

function validateQuizForCompletion(quiz: QuizState): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!quiz.biologicalSex) errors.push('Biological sex is required');
  if (!quiz.age || quiz.age < 13) errors.push('Valid age is required');
  if (!quiz.heightCm || quiz.heightCm <= 0) errors.push('Height is required');
  if (!quiz.weightKg || quiz.weightKg <= 0) errors.push('Weight is required');
  if (!quiz.goal) errors.push('Goal is required');
  if (!quiz.activityLevel) errors.push('Activity level is required');

  return { valid: errors.length === 0, errors };
}

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [quiz, setQuiz] = useState<QuizState>(defaultState);
  const [status, setStatus] = useState<QuizStatus>('pending');
  const [saving, setSaving] = useState(false);
  const { user, refreshProfile } = useAuth();
  const hasLocalChanges = useRef(false);

  const hydrateFromProfile = React.useCallback((rawQuiz: any) => {
    if (!rawQuiz || typeof rawQuiz !== 'object') {
      setQuiz(defaultState);
      setStatus('pending');
      return;
    }

    const payload = 'state' in rawQuiz ? rawQuiz.state : rawQuiz;
    const nextStatus =
      rawQuiz?.status === 'completed' || rawQuiz?.status === 'skipped'
        ? rawQuiz.status
        : 'completed';

    if (!payload || typeof payload !== 'object') {
      setQuiz(defaultState);
      setStatus('pending');
      return;
    }

    setQuiz((prev) => ({
      ...prev,
      ...defaultState,
      ...payload,
      allergens: Array.isArray(payload.allergens)
        ? payload.allergens.filter((a: unknown) => typeof a === 'string')
        : defaultState.allergens,
    }));
    setStatus(nextStatus);
  }, []);

  const updateQuiz = (partial: Partial<QuizState>) => {
    hasLocalChanges.current = true;
    setQuiz((prev) => ({ ...prev, ...partial }));
    if (status === 'pending') {
      setStatus('in_progress');
    }
  };

  const persistQuiz = async (nextStatus: QuizStatus, nextQuiz?: QuizState) => {
    console.log('[quiz] persistQuiz called', { nextStatus, userId: user?.id });
    if (!user?.id) {
      console.warn('[quiz] persistQuiz called without user ID');
      throw new Error('Cannot save quiz: user not authenticated');
    }
    setSaving(true);
    try {
      const payload = {
        state: nextQuiz ?? quiz,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      console.log('[quiz] Upserting to Supabase...');
      // Add timeout to prevent hanging
      const upsertPromise = supabase.from('profiles').upsert({
        id: user.id,
        quiz: payload,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase upsert timed out after 10s')), 10000)
      );
      const { error } = await Promise.race([upsertPromise, timeoutPromise]) as any;
      console.log('[quiz] Supabase upsert complete', { error: error?.message });
      if (error) {
        throw error;
      }
      hasLocalChanges.current = false;
      console.log('[quiz] Calling refreshProfile...');
      await refreshProfile();
      console.log('[quiz] refreshProfile complete');
    } catch (err) {
      console.warn('[quiz] Failed to persist quiz to profile', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const completeQuiz = async () => {
    console.log('[quiz] completeQuiz called', { quiz, userId: user?.id, currentStatus: status });

    // If already completed, just ensure local status is set and skip the save
    if (status === 'completed') {
      console.log('[quiz] Quiz already completed, skipping save');
      return;
    }

    const validation = validateQuizForCompletion(quiz);
    if (!validation.valid) {
      console.log('[quiz] Validation failed:', validation.errors);
      throw new Error(`Quiz incomplete: ${validation.errors.join(', ')}`);
    }

    const quizSnapshot = { ...quiz };
    await persistQuiz('completed', quizSnapshot);
    setStatus('completed');
  };
  const skipQuiz = async () => {
    await persistQuiz('skipped');
    setStatus('skipped');
  };

  const resetQuiz = () => {
    setQuiz(defaultState);
    setStatus('pending');
  };

  // Reset or hydrate quiz when user/profile changes
  React.useEffect(() => {
    console.log('[quiz] Hydration effect triggered', {
      userId: user?.id,
      hasProfile: !!user?.profile,
      hasQuiz: !!user?.profile?.quiz,
      hasLocalChanges: hasLocalChanges.current,
    });

    // Don't overwrite local changes with stale profile data
    if (hasLocalChanges.current) {
      console.log('[quiz] Skipping hydration - local changes pending');
      return;
    }

    if (user?.profile?.quiz) {
      console.log('[quiz] Hydrating from profile', user.profile.quiz);
      hydrateFromProfile(user.profile.quiz);
    } else if (!user?.id) {
      console.log('[quiz] No user - resetting quiz');
      // Only reset if user is logged out, not just if profile.quiz is null
      resetQuiz();
    } else {
      console.log('[quiz] User exists but no quiz data in profile');
    }
  }, [user?.id, user?.profile?.quiz, hydrateFromProfile]);

  const value = useMemo(
    () => ({
      quiz,
      status,
      saving,
      updateQuiz,
      completeQuiz,
      skipQuiz,
      resetQuiz,
    }),
    [quiz, status, saving],
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz() {
  const ctx = useContext(QuizContext);
  if (!ctx) {
    throw new Error('useQuiz must be used within QuizProvider');
  }
  return ctx;
}
