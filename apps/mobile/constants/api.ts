import Constants from 'expo-constants';

/**
 * Compute a default API base URL based on available Expo configuration.
 *
 * The function derives a host from `Constants.expoConfig?.hostUri`, `(Constants.expoGoConfig as any)?.debuggerHost`,
 * or `(Constants as any)?.manifest?.debuggerHost` (in that order) and returns `http://{host}:4000`. If no host can be
 * determined, it falls back to `http://localhost:4000`.
 *
 * @returns The resolved API base URL: `http://{host}:4000` when a host is found, otherwise `http://localhost:4000`.
 */
function defaultHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as any)?.debuggerHost ??
    (Constants as any)?.manifest?.debuggerHost;
  if (hostUri && typeof hostUri === 'string') {
    const host = hostUri.split(':')[0];
    if (host) return `http://${host}:4000`;
  }
  return 'http://localhost:4000';
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultHost();