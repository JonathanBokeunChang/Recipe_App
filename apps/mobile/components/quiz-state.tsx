import React, { createContext, useContext, useMemo, useState } from 'react';
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

export const defaultQuizState: QuizState = {
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

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [quiz, setQuiz] = useState<QuizState>(defaultQuizState);
  const [status, setStatus] = useState<QuizStatus>('pending');
  const [saving, setSaving] = useState(false);
  const { user, refreshProfile } = useAuth();

  const hydrateFromProfile = React.useCallback((rawQuiz: any) => {
    if (!rawQuiz || typeof rawQuiz !== 'object') {
      setQuiz(defaultQuizState);
      setStatus('pending');
      return;
    }

    const payload = 'state' in rawQuiz ? rawQuiz.state : rawQuiz;
    const nextStatus =
      rawQuiz?.status === 'completed' || rawQuiz?.status === 'skipped'
        ? rawQuiz.status
        : 'completed';

    if (!payload || typeof payload !== 'object') {
      setQuiz(defaultQuizState);
      setStatus('pending');
      return;
    }

    setQuiz((prev) => ({
      ...prev,
      ...defaultQuizState,
      ...payload,
      allergens: Array.isArray(payload.allergens)
        ? payload.allergens.filter((a: unknown) => typeof a === 'string')
        : defaultQuizState.allergens,
    }));
    setStatus(nextStatus);
  }, []);

  const updateQuiz = (partial: Partial<QuizState>) => {
    setQuiz((prev) => ({ ...prev, ...partial }));
    if (status === 'pending') {
      setStatus('in_progress');
    }
  };

  const persistQuiz = async (nextStatus: QuizStatus, nextQuiz?: QuizState) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const payload = {
        state: nextQuiz ?? quiz,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        quiz: payload,
      });
      if (error) {
        throw error;
      }
      await refreshProfile();
    } catch (err) {
      console.warn('[quiz] Failed to persist quiz to profile', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const completeQuiz = async () => {
    await persistQuiz('completed');
    setStatus('completed');
  };
  const skipQuiz = async () => {
    await persistQuiz('skipped');
    setStatus('skipped');
  };

  const resetQuiz = () => {
    setQuiz(defaultQuizState);
    setStatus('pending');
  };

  // Reset or hydrate quiz when user/profile changes
  React.useEffect(() => {
    if (user?.profile?.quiz) {
      hydrateFromProfile(user.profile.quiz);
    } else {
      resetQuiz();
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
