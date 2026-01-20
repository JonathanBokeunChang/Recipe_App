import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';

import type { QuizState } from './quiz-state';
import { supabase, logAuthState, restoreSession } from '@/supabaseClient';

const log = (...args: any[]) => console.log('[auth]', ...args);

// ============================================================================
// Types
// ============================================================================

export type GoalType = 'bulk' | 'lean_bulk' | 'cut';
type QuizStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

type Profile = {
  id: string;
  email?: string;
  display_name?: string | null;
  quiz?: { state?: QuizState; status?: QuizStatus; updatedAt?: string } | null;
  goal?: GoalType | null;
  created_at?: string;
  updated_at?: string;
};

type User = {
  id: string;
  email?: string;
  profile?: Profile | null;
  goal?: GoalType;
  kind: 'guest' | 'member';
};

export type SignUpResult = {
  success: boolean;
  needsEmailConfirmation: boolean;
  message: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setGoal: (goal: GoalType) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================================
// Helper Functions
// ============================================================================

function extractGoal(profile?: Profile | null): GoalType | undefined {
  const fromQuiz = profile?.quiz?.state?.goal;
  if (fromQuiz === 'bulk' || fromQuiz === 'lean_bulk' || fromQuiz === 'cut') {
    return fromQuiz;
  }
  if (profile?.goal === 'bulk' || profile?.goal === 'lean_bulk' || profile?.goal === 'cut') {
    return profile.goal;
  }
  return undefined;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  log('fetchProfile called for:', userId);
  try {
    // Add timeout to prevent hanging on slow networks
    const timeoutMs = 15000;
    const fetchPromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timed out')), timeoutMs)
    );

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

    if (error) {
      log('fetchProfile error:', error.message);
      return null;
    }
    log('fetchProfile result:', {
      hasData: !!data,
      hasQuiz: !!data?.quiz,
      quizStatus: data?.quiz?.status,
    });
    return data ?? null;
  } catch (err: any) {
    log('fetchProfile exception:', err?.message ?? err);
    return null;
  }
}

async function upsertProfile(userId: string, email?: string | null): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email: email ?? undefined,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      log('upsertProfile error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    log('upsertProfile exception:', err);
    return false;
  }
}

// ============================================================================
// AuthProvider Component
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Track auth/profile requests to ignore stale responses (e.g., INITIAL_SESSION finishing after SIGNED_IN)
  const authRequestIdRef = useRef(0);
  const profileRequestIdRef = useRef(0);

  // Build user object from session user + profile
  const buildUser = useCallback(
    async (sessionUser: { id: string; email?: string | null }): Promise<User> => {
      const profile = await fetchProfile(sessionUser.id);
      const goal = extractGoal(profile);
      return {
        id: sessionUser.id,
        email: sessionUser.email ?? undefined,
        profile,
        goal,
        kind: 'member',
      };
    },
    []
  );

  // Initialize auth state on mount
  useEffect(() => {
    mountedRef.current = true;
    let isInitialLoad = true;

    log('Setting up auth listener');

    // Immediately try to restore session (handles expired tokens)
    restoreSession().then((session) => {
      if (!mountedRef.current || !isInitialLoad) return;
      if (session) {
        log('Session restored on startup');
        // onAuthStateChange will fire and handle setting the user
      }
    }).catch((err) => {
      log('Session restore error on startup:', err);
    });

    // Listen for auth state changes - this is the primary mechanism
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;

        const requestId = ++authRequestIdRef.current;

        log('onAuthStateChange:', event, session?.user?.id ?? 'no user', {
          requestId,
        });

        if (session?.user) {
          // User is signed in
          try {
            const userObj = await buildUser(session.user);
            if (mountedRef.current && requestId === authRequestIdRef.current) {
              setUser((prev) => {
                const isSameUser = prev?.id === userObj.id;
                return {
                  ...userObj,
                  // Preserve previous profile/goal if this auth event couldn't fetch them (e.g., timeout)
                  profile: userObj.profile ?? (isSameUser ? prev?.profile ?? null : null),
                  goal: userObj.goal ?? (isSameUser ? prev?.goal : undefined),
                };
              });
              log('User set:', userObj.id, { requestId });
            } else {
              log('onAuthStateChange: stale auth update skipped', {
                requestId,
                latestRequestId: authRequestIdRef.current,
              });
            }
          } catch (err) {
            log('Error building user:', err);
            if (mountedRef.current && requestId === authRequestIdRef.current) {
              // Still set a basic user even if profile fetch fails
              setUser({
                id: session.user.id,
                email: session.user.email ?? undefined,
                profile: null,
                goal: undefined,
                kind: 'member',
              });
            }
          }
        } else {
          // No session - user is signed out
          if (mountedRef.current) {
            setUser(null);
          }
        }

        // Mark loading as complete after first auth state change
        if (isInitialLoad && mountedRef.current && requestId === authRequestIdRef.current) {
          isInitialLoad = false;
          setLoading(false);
          log('Initial auth complete, loading=false');
        }
      }
    );

    // Fallback: if onAuthStateChange doesn't fire within 3 seconds, check manually
    const timeoutId = setTimeout(async () => {
      if (isInitialLoad && mountedRef.current) {
        log('Timeout reached, checking session manually');
        try {
          // Use restoreSession to handle expired tokens
          const session = await restoreSession();
          if (mountedRef.current && isInitialLoad) {
            if (session?.user) {
              const userObj = await buildUser(session.user);
              setUser(userObj);
            } else {
              setUser(null);
            }
            isInitialLoad = false;
            setLoading(false);
            log('Manual session check complete');
          }
        } catch (err) {
          log('Manual session check error:', err);
          if (mountedRef.current && isInitialLoad) {
            setUser(null);
            isInitialLoad = false;
            setLoading(false);
          }
        }
      }
    }, 3000);

    return () => {
      mountedRef.current = false;
      subscription?.subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [buildUser]);

  // Sign in with email and password
  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<void> => {
      log('signInWithEmail: starting', { email });
      setLoading(true);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          log('signInWithEmail error:', error.message);
          setLoading(false);
          throw error;
        }

        if (!data.session?.user) {
          setLoading(false);
          throw new Error('Sign in failed: no session returned');
        }

        log('signInWithEmail: success', { userId: data.session.user.id });

        // Ensure profile exists
        await upsertProfile(data.session.user.id, data.session.user.email);

        // onAuthStateChange will handle setting the user, but we need to set loading false
        // since the isInitialLoad flag is already false after initial mount
        setLoading(false);

        await logAuthState('after-signIn');
      } catch (err) {
        setLoading(false);
        throw err;
      }
    },
    []
  );

  // Sign up with email and password
  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      log('signUpWithEmail: starting', { email });
      setLoading(true);

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          log('signUpWithEmail error:', error.message);
          setLoading(false);
          throw error;
        }

        // Check if email confirmation is required
        if (data.user && !data.session) {
          log('signUpWithEmail: email confirmation required');
          setLoading(false);
          return {
            success: true,
            needsEmailConfirmation: true,
            message:
              'Account created! Please check your email to confirm your account before signing in.',
          };
        }

        // Instant sign in (no email confirmation required)
        if (data.session?.user) {
          log('signUpWithEmail: success with immediate session', {
            userId: data.session.user.id,
          });

          await upsertProfile(data.session.user.id, data.session.user.email);
          // onAuthStateChange will handle setting the user, but we need to set loading false
          setLoading(false);

          return {
            success: true,
            needsEmailConfirmation: false,
            message: 'Account created successfully!',
          };
        }

        // Unexpected state
        log('signUpWithEmail: unexpected response', data);
        setLoading(false);
        return {
          success: false,
          needsEmailConfirmation: false,
          message: 'Sign up failed. Please try again.',
        };
      } catch (err) {
        setLoading(false);
        throw err;
      }
    },
    []
  );

  // Sign out
  const signOut = useCallback(async (): Promise<void> => {
    log('signOut: starting');
    setLoading(true);

    try {
      await supabase.auth.signOut();
      // onAuthStateChange will handle clearing the user
      log('signOut: complete');
      // Always set loading false after signOut completes
      // onAuthStateChange only sets loading=false on initial load
      setLoading(false);
    } catch (err) {
      log('signOut error:', err);
      // Force clear user state even if signOut fails
      setUser(null);
      setLoading(false);
    }
  }, []);

  // Refresh profile from database
  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!user?.id) return;

    const requestId = ++profileRequestIdRef.current;
    const currentUserId = user.id;

    log('refreshProfile: starting', { userId: currentUserId, requestId });
    const profile = await fetchProfile(currentUserId);
    const goal = extractGoal(profile);

    if (requestId !== profileRequestIdRef.current) {
      log('refreshProfile: stale response ignored', {
        requestId,
        latestRequestId: profileRequestIdRef.current,
      });
      return;
    }

    log('refreshProfile: extracted data', {
      hasProfile: !!profile,
      hasQuiz: !!profile?.quiz,
      quizStatus: profile?.quiz?.status,
      quizStateGoal: profile?.quiz?.state?.goal,
      profileGoal: profile?.goal,
      extractedGoal: goal,
    });

    setUser((prev) => {
      if (!prev || prev.id !== currentUserId) return prev;
      const updatedUser = {
        ...prev,
        profile: profile ?? prev.profile ?? null,
        goal: goal ?? prev.goal,
      };
      log('refreshProfile: user state updated', {
        prevGoal: prev.goal,
        newGoal: updatedUser.goal
      });
      return updatedUser;
    });
    log('refreshProfile: complete');
  }, [user?.id]);

  // Update user goal
  const setGoal = useCallback(
    async (goal: GoalType): Promise<void> => {
      if (!user?.id) return;

      log('setGoal: starting', { goal });

      // Optimistically update local state
      const existingState = user.profile?.quiz?.state;
      const nextQuiz = {
        state: existingState ? { ...existingState, goal } : ({ goal } as QuizState),
        status: (user.profile?.quiz?.status ?? 'completed') as QuizStatus,
        updatedAt: new Date().toISOString(),
      };

      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          goal,
          profile: prev.profile
            ? { ...prev.profile, quiz: nextQuiz }
            : prev.profile,
        };
      });

      // Persist to database
      try {
        const { data, error } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          quiz: nextQuiz,
          updated_at: new Date().toISOString(),
        }).select('id, quiz');

        log('setGoal: persist response', {
          hasData: !!data,
          dataLength: data?.length,
          error: error?.message,
          returnedGoal: data?.[0]?.quiz?.state?.goal,
        });

        if (error) {
          log('setGoal: persist error', error.message, error.code);
        } else {
          await refreshProfile();
        }
      } catch (err) {
        log('setGoal: exception', err);
      }
    },
    [user?.id, user?.email, user?.profile?.quiz, refreshProfile]
  );

  // Memoize context value
  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshProfile,
      setGoal,
    }),
    [user, loading, signInWithEmail, signUpWithEmail, signOut, refreshProfile, setGoal]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
