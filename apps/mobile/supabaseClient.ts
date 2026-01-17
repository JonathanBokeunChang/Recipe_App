import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

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
  throw new Error(
    'Supabase env vars missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env (or expo.extra).',
  );
}

const isWeb = Platform.OS === 'web';
const storage = isWeb
  ? undefined // let supabase-js handle browser storage (localStorage)
  : AsyncStorage;

// Log sanitized env so we can catch misconfig (do not log full keys).
console.log('[supabase] init', {
  url: supabaseUrl,
  anonKeyPrefix: supabaseAnonKey ? `${supabaseAnonKey.slice(0, 8)}...` : 'missing',
  platform: Platform.OS,
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Disable navigator.locks API which causes "signal is aborted without reason"
    // errors on React Native where the Web Locks API isn't available
    lock: async (_name: string, _acquireTimeout: number, callback: () => Promise<any>) => {
      // Simply run the callback without locking - React Native doesn't need
      // cross-tab coordination since there's only one "tab"
      return await callback();
    },
  },
  global: {
    fetch: (url, options = {}) => {
      // Remove abort signal to avoid React 19 / Supabase compatibility issue
      const { signal, ...rest } = options as RequestInit & { signal?: AbortSignal };
      return fetch(url, rest);
    },
  },
});
