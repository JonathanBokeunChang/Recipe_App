import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, View } from 'react-native';
import { useEffect, useState, useRef, useCallback } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/components/auth';
import { QuizProvider, useQuiz } from '@/components/quiz-state';
import { RecipeLibraryProvider } from '@/lib/recipe-library-context';
import { MacroTrackingProvider } from '@/components/macro-tracking-state';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

// Prevent splash screen from auto-hiding before asset loading completes
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <QuizProvider>
        <MacroTrackingProvider>
          <RecipeLibraryProvider>
            <RootLayoutNav />
          </RecipeLibraryProvider>
        </MacroTrackingProvider>
      </QuizProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading: authLoading } = useAuth();
  const { status: quizStatus } = useQuiz();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const hasNavigatedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Track navigation readiness
  useEffect(() => {
    if (navigationState?.key && navigationState.routes?.length) {
      setIsNavigationReady(true);
    }
  }, [navigationState?.key, navigationState?.routes?.length]);

  // Determine the correct route based on auth and quiz state
  const getTargetRoute = useCallback((): string | null => {
    const inAuthGroup = segments[0] === '(auth)';
    const inQuiz = segments[0] === 'quiz';

    console.log('[routing] getTargetRoute', {
      hasUser: !!user,
      quizStatus,
      inAuthGroup,
      inQuiz,
      currentSegment: segments[0],
    });

    // Not authenticated - go to sign-in
    if (!user) {
      if (!inAuthGroup) {
        return '/(auth)/sign-in';
      }
      return null; // Already in auth, no navigation needed
    }

    // Authenticated - go to main app (quiz is optional)
    // Users can complete quiz later via Profile page
    if (inAuthGroup) {
      return '/(tabs)';
    }

    return null; // Already in the right place
  }, [user, quizStatus, segments]);

  // Handle navigation based on auth state
  useEffect(() => {
    // Wait for navigation to be ready and auth to finish loading
    if (!isNavigationReady || authLoading) {
      console.log('[routing] Navigation effect skipped - not ready', { isNavigationReady, authLoading });
      return;
    }

    // Detect user change (sign in/out)
    const currentUserId = user?.id ?? null;
    const userChanged = currentUserId !== lastUserIdRef.current;
    lastUserIdRef.current = currentUserId;

    // If user changed, reset navigation flag to allow new navigation
    if (userChanged) {
      hasNavigatedRef.current = false;
    }

    console.log('[routing] Navigation effect running', {
      isNavigationReady,
      authLoading,
      userId: user?.id,
      quizStatus,
      currentSegment: segments[0],
      hasNavigated: hasNavigatedRef.current,
      userChanged,
    });

    const targetRoute = getTargetRoute();

    console.log('[routing] Decision', {
      targetRoute,
      willNavigate: !!targetRoute && !hasNavigatedRef.current,
    });

    if (targetRoute && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      console.log('[routing] Navigating to:', targetRoute);
      // Use setTimeout to ensure navigation happens after render
      setTimeout(() => {
        router.replace(targetRoute as any);
      }, 0);
    }
  }, [
    isNavigationReady,
    authLoading,
    user?.id,
    quizStatus,
    segments,
    router,
    getTargetRoute,
  ]);

  // Reset navigation flag when segments change (user navigated manually)
  useEffect(() => {
    hasNavigatedRef.current = false;
  }, [segments[0]]);

  // Show loading state while initializing
  if (!isNavigationReady || authLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
        }}
      >
        <ActivityIndicator
          size="large"
          color={colorScheme === 'dark' ? '#fff' : '#000'}
        />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="quiz" options={{ headerShown: false }} />
        <Stack.Screen
          name="paste-link"
          options={{ title: 'Paste video link', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="upload-recipe-image"
          options={{ title: 'Scan recipe photo', headerBackTitle: 'Back' }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
