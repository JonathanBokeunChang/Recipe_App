import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, View } from 'react-native';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/components/auth';
import { QuizProvider, useQuiz } from '@/components/quiz-state';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(auth)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <QuizProvider>
        <RootLayoutNav />
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

  useEffect(() => {
    if (navigationState?.key && navigationState.routes?.length) {
      setIsNavigationReady(true);
    }
  }, [navigationState?.key, navigationState?.routes?.length]);

  useEffect(() => {
    if (!isNavigationReady || authLoading) return; // wait for nav + auth
    const inAuthGroup = segments[0] === '(auth)';
    const inQuiz = segments[0] === 'quiz';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    }
    if (user && quizStatus !== 'completed' && quizStatus !== 'skipped' && !inQuiz) {
      router.replace('/quiz');
      return;
    }
    if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, segments, router, isNavigationReady, quizStatus, authLoading]);

  if (!isNavigationReady || authLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
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
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
