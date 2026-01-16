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
  },
});
