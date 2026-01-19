import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createClient, Session } from '@supabase/supabase-js';

const log = (...args: any[]) => console.log('[supabase]', ...args);
const logError = (...args: any[]) => console.error('[supabase] ERROR:', ...args);

// ============================================================================
// Environment Configuration
// ============================================================================

const extra = Constants.expoConfig?.extra ?? (Constants as any)?.manifest?.extra ?? {};
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (extra as Record<string, any>)?.supabaseUrl ??
  '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (extra as Record<string, any>)?.supabaseAnonKey ??
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  logError('Supabase env vars missing!');
  throw new Error(
    'Supabase env vars missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env',
  );
}

log('init', {
  url: supabaseUrl,
  anonKeyPrefix: supabaseAnonKey.slice(0, 8) + '...',
  platform: Platform.OS,
});

// ============================================================================
// Storage Configuration
// ============================================================================

const isWeb = Platform.OS === 'web';

// Custom storage wrapper for AsyncStorage to ensure proper error handling
const asyncStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value;
    } catch (error) {
      logError('AsyncStorage getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      logError('AsyncStorage setItem error:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      logError('AsyncStorage removeItem error:', error);
    }
  },
};

const storage = isWeb ? undefined : asyncStorageAdapter;

// ============================================================================
// Supabase Client
// ============================================================================

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Disable navigator.locks API - not available in React Native
    lock: async (_name: string, _acquireTimeout: number, callback: () => Promise<any>) => {
      return await callback();
    },
    // Increase token refresh margin to prevent edge cases
    flowType: 'pkce',
  },
  global: {
    fetch: (url, options = {}) => {
      // Remove abort signal to avoid React 19 / Supabase compatibility issue
      const { signal, ...rest } = options as RequestInit & { signal?: AbortSignal };
      return fetch(url, rest);
    },
  },
});

log('Client created successfully');

// ============================================================================
// Session Helper Functions
// ============================================================================

/**
 * Get the current session, returning null if none exists or if expired
 */
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logError('getCurrentSession error:', error.message);
      return null;
    }
    return data.session;
  } catch (err) {
    logError('getCurrentSession exception:', err);
    return null;
  }
}

/**
 * Restore a session from storage and ensure the client is ready for authenticated requests.
 * This is critical after app restart - getSession alone doesn't set auth headers.
 */
export async function restoreSession(): Promise<Session | null> {
  try {
    const { data: { session }, error: getError } = await supabase.auth.getSession();

    if (getError) {
      logError('restoreSession getSession error:', getError.message);
      return null;
    }

    if (!session) {
      log('restoreSession: no session found');
      return null;
    }

    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at < now) {
      log('restoreSession: session expired, attempting refresh');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        logError('restoreSession: refresh failed', refreshError?.message);
        await supabase.auth.signOut();
        return null;
      }
      log('restoreSession: session refreshed successfully');
      return refreshData.session;
    }

    // CRITICAL: Call setSession to ensure auth headers are set on the client
    // getSession() only reads from storage but doesn't initialize the client
    const { error: setError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    if (setError) {
      logError('restoreSession setSession error:', setError.message);
      // If the session is invalid, sign out to clear stale data
      if (
        setError.message.includes('expired') ||
        setError.message.includes('invalid') ||
        setError.code === 'invalid_grant'
      ) {
        log('restoreSession: session invalid, signing out');
        await supabase.auth.signOut();
        return null;
      }
      return null;
    }

    log('restoreSession: success', {
      userId: session.user.id,
      email: session.user.email,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : 'unknown',
    });

    return session;
  } catch (err) {
    logError('restoreSession exception:', err);
    return null;
  }
}

/**
 * Clear all auth data - use when session is corrupted or on explicit sign out
 */
export async function clearAuthData(): Promise<void> {
  try {
    await supabase.auth.signOut();
    if (!isWeb) {
      // Clear any stale keys from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const authKeys = keys.filter(
        (k) => k.includes('supabase') || k.includes('auth-token')
      );
      if (authKeys.length > 0) {
        await AsyncStorage.multiRemove(authKeys);
        log('clearAuthData: removed', authKeys.length, 'keys');
      }
    }
  } catch (err) {
    logError('clearAuthData error:', err);
  }
}

/**
 * Debug helper - log current auth state
 */
export async function logAuthState(context: string): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    console.log(`[AUTH STATE] ${context}:`, {
      hasSession: !!session,
      userId: session?.user?.id ?? 'none',
      email: session?.user?.email ?? 'none',
      expiresAt: session?.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : 'N/A',
      error: error?.message ?? 'none',
    });
    return session ?? null;
  } catch (err) {
    console.error(`[AUTH STATE] ${context}: error`, err);
    return null;
  }
}
