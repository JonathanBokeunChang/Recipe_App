import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../auth';

// Get the mocked supabase client
const mockSupabase = (global as any).mockSupabaseClient;

// Helper to create a mock session
const createMockSession = (userId: string, email: string) => ({
  user: { id: userId, email },
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
});

// Helper to create a mock profile
const createMockProfile = (userId: string, opts?: { quiz?: any; goal?: string }) => ({
  id: userId,
  email: 'test@example.com',
  quiz: opts?.quiz ?? null,
  goal: opts?.goal ?? null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks to default state
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  describe('Initial State', () => {
    it('should start with loading=true and user=null', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
    });

    it('should set loading=false after auth state resolves with no user', async () => {
      let authCallback: Function | null = null;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: Function) => {
        authCallback = callback;
        // Simulate immediate callback with no session
        setTimeout(() => callback('INITIAL_SESSION', null), 0);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('signInWithEmail', () => {
    it('should sign in successfully and set user with profile', async () => {
      const mockSession = createMockSession('user-123', 'test@example.com');
      const mockProfile = createMockProfile('user-123', {
        quiz: { state: { goal: 'bulk' }, status: 'completed' },
      });

      // Setup sign in to succeed
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Setup profile upsert to succeed
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
      });

      // Capture the auth state change callback
      let authCallback: Function | null = null;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: Function) => {
        authCallback = callback;
        setTimeout(() => callback('INITIAL_SESSION', null), 0);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Perform sign in
      await act(async () => {
        await result.current.signInWithEmail('test@example.com', 'password123');
      });

      // Verify sign in was called
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should throw error on invalid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid login credentials' },
      });

      let authCallback: Function | null = null;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: Function) => {
        authCallback = callback;
        setTimeout(() => callback('INITIAL_SESSION', null), 0);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signInWithEmail('test@example.com', 'wrongpassword');
        })
      ).rejects.toEqual({ message: 'Invalid login credentials' });
    });
  });

  describe('signOut', () => {
    it('should sign out and set loading=false (not infinite loading)', async () => {
      const mockSession = createMockSession('user-123', 'test@example.com');
      const mockProfile = createMockProfile('user-123');

      let authCallback: Function | null = null;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: Function) => {
        authCallback = callback;
        // Start with a logged-in user
        setTimeout(() => callback('INITIAL_SESSION', mockSession), 0);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
      });

      mockSupabase.auth.signOut.mockImplementation(async () => {
        // Simulate auth state change to signed out
        if (authCallback) {
          authCallback('SIGNED_OUT', null);
        }
        return { error: null };
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial auth to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Sign out
      await act(async () => {
        await result.current.signOut();
      });

      // CRITICAL: Verify loading is false after sign out (this was the bug)
      expect(result.current.loading).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('Goal Extraction', () => {
    it('should extract goal from profile.quiz.state.goal', async () => {
      const mockSession = createMockSession('user-123', 'test@example.com');
      const mockProfile = createMockProfile('user-123', {
        quiz: {
          state: { goal: 'lean_bulk', biologicalSex: 'male', age: 25 },
          status: 'completed',
        },
      });

      let authCallback: Function | null = null;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: Function) => {
        authCallback = callback;
        setTimeout(() => callback('SIGNED_IN', mockSession), 0);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).not.toBeNull();
      });

      // Verify goal was extracted from quiz
      expect(result.current.user?.goal).toBe('lean_bulk');
    });

    it('should fallback to profile.goal if quiz.state.goal is not set', async () => {
      const mockSession = createMockSession('user-123', 'test@example.com');
      const mockProfile = createMockProfile('user-123', {
        quiz: { state: {}, status: 'skipped' },
        goal: 'cut',
      });

      let authCallback: Function | null = null;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: Function) => {
        authCallback = callback;
        setTimeout(() => callback('SIGNED_IN', mockSession), 0);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user?.goal).toBe('cut');
      });
    });
  });

  describe('setGoal', () => {
    it('should persist goal to database with email and updated_at fields', async () => {
      const mockSession = createMockSession('user-123', 'test@example.com');
      const mockProfile = createMockProfile('user-123', {
        quiz: { state: { goal: 'bulk' }, status: 'completed' },
      });

      let authCallback: Function | null = null;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: Function) => {
        authCallback = callback;
        setTimeout(() => callback('SIGNED_IN', mockSession), 0);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      const mockUpsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [{ id: 'user-123' }], error: null }),
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        upsert: mockUpsert,
        maybeSingle: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      // Set a new goal
      await act(async () => {
        await result.current.setGoal('cut');
      });

      // Verify upsert was called with email and updated_at
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          updated_at: expect.any(String),
          quiz: expect.objectContaining({
            state: expect.objectContaining({ goal: 'cut' }),
          }),
        })
      );
    });
  });
});
