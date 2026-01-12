import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/components/auth';

export default function SignInScreen() {
  const { signInGuest } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const buttonStyle = [
    styles.primaryButton,
    { backgroundColor: isDark ? '#F9FAFB' : '#111827' },
  ];
  const buttonTextStyle = [
    styles.primaryButtonText,
    { color: isDark ? '#111827' : '#F9FAFB' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Video-to-Recipe</Text>
          <Text style={styles.title}>Cook smarter with macros.</Text>
          <Text style={styles.subtitle}>
            Paste a link or upload a video. We turn it into a clean recipe with estimated
            calories and macros in under a minute.
          </Text>
        </View>

        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0B0F19">
          <Text style={styles.cardTitle}>Get started</Text>
          <Text style={styles.cardBody}>
            Continue as a guest to explore the app. Sign-in options can be added next.
          </Text>
          <Pressable style={buttonStyle} onPress={signInGuest}>
            <Text style={buttonTextStyle}>Continue as Guest</Text>
          </Pressable>
          <Text style={styles.helperText}>
            Email, Google, and Apple sign-in coming next.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  hero: {
    gap: 12,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  card: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    opacity: 0.7,
  },
});
