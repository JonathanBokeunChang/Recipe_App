import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { QuizState } from './quiz-state';
import { supabase } from '@/supabaseClient';

const logAuth = (...args: any[]) => {
  // eslint-disable-next-line no-console
  console.log('[auth]', ...args);
};

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
  kind?: 'guest' | 'member';
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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[auth] Failed to fetch profile', error);
    return null;
  }
  return data ?? null;
}

async function upsertProfile(userId: string, email?: string | null) {
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    email: email ?? undefined,
  });
  if (error) {
    console.warn('[auth] Failed to upsert profile', error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const bootstrapUser = async (sessionUser: { id: string; email?: string | null }) => {
    const profile = await fetchProfile(sessionUser.id);
    const goal = extractGoal(profile);
    setUser({
      id: sessionUser.id,
      email: sessionUser.email ?? undefined,
      profile,
      goal,
      kind: 'member',
    });
  };

  useEffect(() => {
    let isMounted = true;
    let initialSessionHandled = false;

    logAuth('bootstrap: setting up auth listener');

    // Explicitly fetch session on mount (required for older Supabase versions
    // that don't fire INITIAL_SESSION event)
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        // If already handled by onAuthStateChange, just ensure loading is false
        if (!isMounted) return;
        if (initialSessionHandled) {
          logAuth('bootstrap: getSession skipped (already handled by auth state change)');
          setLoading(false);
          return;
        }

        initialSessionHandled = true;
        logAuth('bootstrap: getSession result', {
          hasSession: !!session,
          userId: session?.user?.id,
          error: error?.message
        });

        if (session?.user) {
          await bootstrapUser(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        logAuth('bootstrap: getSession error', err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initSession();

    // Also listen for auth state changes (sign in, sign out, token refresh)
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      logAuth('auth state change:', event, session?.user?.id ?? 'no user');

      // Skip INITIAL_SESSION if we already handled it via getSession
      if (event === 'INITIAL_SESSION') {
        if (initialSessionHandled) {
          logAuth('skipping INITIAL_SESSION (already handled)');
          return;
        }
        initialSessionHandled = true;
      }

      // Mark as handled so initSession knows to skip
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        initialSessionHandled = true;
      }

      try {
        if (session?.user) {
          logAuth('auth state change: session found', {
            id: session.user.id,
            email: session.user.email,
          });
          await bootstrapUser(session.user);
        } else {
          logAuth('auth state change: no session');
          setUser(null);
        }
      } catch (err) {
        logAuth('auth state change: bootstrapUser error', err);
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    logAuth('signInWithEmail start', { email });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logAuth('signInWithEmail error', error);
      setLoading(false);
      throw error;
    }
    if (data.session?.user) {
      logAuth('signInWithEmail success', {
        id: data.session.user.id,
        email: data.session.user.email,
      });
      await upsertProfile(data.session.user.id, data.session.user.email);
      await bootstrapUser(data.session.user);
    } else {
      logAuth('signInWithEmail: no session returned');
    }
    setLoading(false);
  };

  const signUpWithEmail = async (email: string, password: string): Promise<SignUpResult> => {
    setLoading(true);
    logAuth('signUpWithEmail start', { email });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        logAuth('signUpWithEmail error', error);
        throw error;
      }
      if (data.session?.user) {
        logAuth('signUpWithEmail success (session present)', {
          id: data.session.user.id,
          email: data.session.user.email,
        });
        await upsertProfile(data.session.user.id, data.session.user.email);
        await bootstrapUser(data.session.user);
        return {
          success: true,
          needsEmailConfirmation: false,
          message: 'Account created successfully.',
        };
      } else if (data.user && !data.session) {
        // User created but no session means email confirmation is required
        logAuth('signUpWithEmail: email confirmation required');
        return {
          success: true,
          needsEmailConfirmation: true,
          message: 'Account created. Please check your email to confirm your account before signing in.',
        };
      } else {
        logAuth('signUpWithEmail: unexpected state - no user or session');
        return {
          success: false,
          needsEmailConfirmation: false,
          message: 'Sign up failed. Please try again.',
        };
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    const currentUser = user?.id;
    if (!currentUser) return;
    const profile = await fetchProfile(currentUser);
    const goal = extractGoal(profile);
    setUser((prev) =>
      prev
        ? {
            ...prev,
            profile,
            goal: goal ?? prev.goal,
          }
        : prev,
    );
  };

  const signOut = async () => {
    setLoading(true);
    logAuth('signOut start');
    await supabase.auth.signOut();
    setUser(null);
    logAuth('signOut done');
    setLoading(false);
  };

  const setGoal = async (goal: GoalType) => {
    if (!user?.id) return;

    const existingState = user.profile?.quiz?.state;
    const nextQuiz: NonNullable<Profile['quiz']> = {
      state: existingState ? { ...existingState, goal } : { goal } as QuizState,
      status: user.profile?.quiz?.status ?? 'completed',
      updatedAt: new Date().toISOString(),
    };

    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        goal,
        profile: prev.profile ? { ...prev.profile, quiz: nextQuiz } : prev.profile,
      };
    });

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      quiz: nextQuiz,
    });
    if (error) {
      console.warn('[auth] Failed to persist goal to profile', error);
    } else {
      await refreshProfile();
    }
  };

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
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
