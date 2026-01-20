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
    console.log('[quiz] persistQuiz called', { nextStatus, userId: user?.id, userEmail: user?.email });
    if (!user?.id) {
      console.warn('[quiz] persistQuiz called without user ID');
      throw new Error('Cannot save quiz: user not authenticated');
    }
    setSaving(true);

    const quizPayload = {
      state: nextQuiz ?? quiz,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    console.log('=== SUPABASE PAYLOAD ===');
    console.log('Payload being sent to Supabase:', JSON.stringify(quizPayload, null, 2));
    console.log('=== END PAYLOAD ===');

    // Retry logic with exponential backoff
    const maxRetries = 3;
    const baseDelay = 500;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[quiz] Upserting to Supabase (attempt ${attempt}/${maxRetries})...`);
        console.log('[quiz] Quiz payload:', JSON.stringify(quizPayload, null, 2));

        // Include email and updated_at in the upsert to ensure profile row exists
        // and to comply with any RLS policies that might require these fields
        const { data, error } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          quiz: quizPayload,
          updated_at: new Date().toISOString(),
        }).select('id, quiz');

        console.log('[quiz] Supabase upsert response', {
          error: error?.message,
          errorCode: error?.code,
          hasData: !!data,
          dataLength: data?.length,
          returnedQuizStatus: data?.[0]?.quiz?.status,
        });

        if (error) {
          throw new Error(`Supabase error: ${error.message} (code: ${error.code})`);
        }

        // Detect silent RLS failure: upsert returns no error but also no data
        // When RLS blocks an insert/update, Supabase returns { data: [], error: null }
        if (!data || data.length === 0) {
          console.warn('[quiz] Possible RLS silent failure - no data returned from upsert');
          // Verify by reading back the profile
          const { data: verifyData, error: verifyError } = await supabase
            .from('profiles')
            .select('quiz')
            .eq('id', user.id)
            .single();

          console.log('[quiz] Verification read result:', {
            verifyError: verifyError?.message,
            hasVerifyData: !!verifyData,
            verifyQuizStatus: verifyData?.quiz?.status,
            verifyQuizGoal: verifyData?.quiz?.state?.goal,
          });

          if (verifyError) {
            throw new Error(`Verification failed: ${verifyError.message}`);
          }

          // Check if the quiz was actually saved with correct status
          const savedStatus = verifyData?.quiz?.status;
          if (savedStatus !== nextStatus) {
            console.error('[quiz] Status mismatch after save', { savedStatus, expected: nextStatus });
            throw new Error('Quiz save verification failed - data may not have been persisted due to RLS policy');
          }
          console.log('[quiz] Verification successful - quiz was saved despite empty upsert response');
        } else {
          // Verify the returned data has the correct status
          const returnedStatus = data[0]?.quiz?.status;
          if (returnedStatus !== nextStatus) {
            console.warn('[quiz] Returned status does not match expected', { returnedStatus, expected: nextStatus });
          }
        }

        // Success - reset local changes flag and refresh
        hasLocalChanges.current = false;
        console.log('[quiz] Calling refreshProfile...');
        await refreshProfile();
        console.log('[quiz] refreshProfile complete');
        setSaving(false);
        return; // Success - exit the retry loop

      } catch (err: any) {
        lastError = err;
        console.warn(`[quiz] Attempt ${attempt} failed:`, err?.message);

        // Don't retry on certain errors
        if (err?.message?.includes('user not authenticated') ||
            err?.message?.includes('RLS policy')) {
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`[quiz] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    hasLocalChanges.current = true; // Keep flag set so we know there are unsaved changes
    setSaving(false);
    console.error('[quiz] All retry attempts failed', lastError);
    throw lastError ?? new Error('Failed to save quiz after multiple attempts');
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
    console.log('=== QUIZ SAVE DEBUG ===');
    console.log('Quiz snapshot to save:', JSON.stringify(quizSnapshot, null, 2));
    console.log('Key fields check:', {
      biologicalSex: quizSnapshot.biologicalSex,
      age: quizSnapshot.age,
      heightCm: quizSnapshot.heightCm,
      weightKg: quizSnapshot.weightKg,
      goal: quizSnapshot.goal,
      activityLevel: quizSnapshot.activityLevel,
    });
    console.log('=== END DEBUG ===');
    console.log('[quiz-state] completeQuiz: calling persistQuiz with status=completed');
    await persistQuiz('completed', quizSnapshot);
    console.log('[quiz-state] completeQuiz: persistQuiz finished, about to setStatus');
    setStatus('completed');
    console.log('[quiz-state] completeQuiz: setStatus(completed) called');
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
      profileQuizStatus: user?.profile?.quiz?.status,
      profileQuizGoal: user?.profile?.quiz?.state?.goal,
      currentLocalStatus: status,
      hasLocalChanges: hasLocalChanges.current,
    });

    // Don't overwrite local changes with stale profile data
    if (hasLocalChanges.current) {
      console.log('[quiz] Skipping hydration - local changes pending');
      return;
    }

    if (user?.profile?.quiz) {
      console.log('[quiz] Hydrating from profile', {
        status: user.profile.quiz.status,
        goal: user.profile.quiz.state?.goal,
        age: user.profile.quiz.state?.age,
        weight: user.profile.quiz.state?.weightKg,
        updatedAt: user.profile.quiz.updatedAt,
      });
      console.log('[quiz] FULL QUIZ DATA TO HYDRATE:', JSON.stringify(user.profile.quiz, null, 2));
      hydrateFromProfile(user.profile.quiz);
    } else if (!user?.id) {
      console.log('[quiz] No user - resetting quiz');
      // Only reset if user is logged out, not just if profile.quiz is null
      resetQuiz();
    } else {
      console.log('[quiz] User exists but no quiz data in profile - this may indicate a save failure');
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
