import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/components/auth';

export default function SignInScreen() {
  const { signInWithEmail, signUpWithEmail, loading } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isValid = useMemo(() => {
    return email.trim().length > 3 && password.trim().length >= 6;
  }, [email, password]);

  const submit = async () => {
    setError(null);
    setMessage(null);
    if (!isValid) {
      setError('Enter a valid email and a password (min 6 chars).');
      return;
    }

    try {
      if (mode === 'signIn') {
        await signInWithEmail(email.trim(), password);
        setMessage('Signed in. Redirecting…');
      } else {
        await signUpWithEmail(email.trim(), password);
        setMessage('Account created. Check your email if confirmation is required.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed.');
    }
  };

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
          <Text style={styles.cardTitle}>
            {mode === 'signIn' ? 'Sign in' : 'Create account'}
          </Text>
          <Text style={styles.cardBody}>
            Keep your preferences and quiz settings synced to your profile.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={email}
              onChangeText={setEmail}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                  color: isDark ? '#F9FAFB' : '#111827',
                },
              ]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={password}
              onChangeText={setPassword}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                  color: isDark ? '#F9FAFB' : '#111827',
                },
              ]}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: isDark ? '#F9FAFB' : '#111827' },
              (!isValid || loading) && styles.primaryDisabled,
            ]}
            onPress={submit}
            disabled={!isValid || loading}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: isDark ? '#111827' : '#F9FAFB' },
              ]}
            >
              {mode === 'signIn' ? 'Sign in' : 'Sign up'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.switchButton}
            onPress={() => {
              setMode((prev) => (prev === 'signIn' ? 'signUp' : 'signIn'));
              setError(null);
              setMessage(null);
            }}
          >
            <Text style={styles.switchText}>
              {mode === 'signIn'
                ? "Don't have an account? Create one"
                : 'Have an account? Sign in'}
            </Text>
          </Pressable>
          <Text style={styles.helperText}>
            We use Supabase auth. Email confirmation may be required depending on project settings.
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
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
  },
  success: {
    color: '#059669',
    fontSize: 13,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    opacity: 0.7,
  },
});
