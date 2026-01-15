import React, { createContext, useContext, useMemo, useState } from 'react';

export type GoalType = 'bulk' | 'lean_bulk' | 'cut';

type User = {
  id: string;
  kind: 'guest';
  createdAt: string;
  goal?: GoalType;
};

type AuthContextValue = {
  user: User | null;
  signInGuest: () => void;
  signOut: () => void;
  setGoal: (goal: GoalType) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const signInGuest = () => {
    const id = `guest_${Math.random().toString(36).slice(2, 10)}`;
    setUser({ id, kind: 'guest', createdAt: new Date().toISOString() });
  };

  const signOut = () => setUser(null);

  const setGoal = (goal: GoalType) => {
    if (user) {
      setUser({ ...user, goal });
    }
  };

  const value = useMemo(() => ({ user, signInGuest, signOut, setGoal }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
