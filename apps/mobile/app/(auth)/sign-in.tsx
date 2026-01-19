import React, { useMemo, useState, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/components/auth';

type FormMode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const { signInWithEmail, signUpWithEmail, loading } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<FormMode>('signIn');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate form inputs
  const isValid = useMemo(() => {
    const emailTrimmed = email.trim();
    const passwordTrimmed = password.trim();
    // Basic email validation
    const emailValid = emailTrimmed.length > 3 && emailTrimmed.includes('@');
    const passwordValid = passwordTrimmed.length >= 6;
    return emailValid && passwordValid;
  }, [email, password]);

  // Convert Supabase errors to user-friendly messages
  const getErrorMessage = useCallback((err: any): string => {
    const msg = err?.message ?? 'Authentication failed. Please try again.';

    if (msg.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (msg.includes('User already registered')) {
      return 'An account with this email already exists. Please sign in instead.';
    }
    if (msg.includes('Email not confirmed')) {
      return 'Please check your email and confirm your account before signing in.';
    }
    if (msg.includes('Invalid email')) {
      return 'Please enter a valid email address.';
    }
    if (msg.includes('Password')) {
      return 'Password must be at least 6 characters.';
    }
    if (msg.includes('Network') || msg.includes('fetch')) {
      return 'Network error. Please check your internet connection.';
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return 'Too many attempts. Please wait a moment and try again.';
    }

    return msg;
  }, []);

  const submit = useCallback(async () => {
    if (!isValid || isSubmitting) return;

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const emailTrimmed = email.trim().toLowerCase();
    const passwordTrimmed = password.trim();

    try {
      if (mode === 'signIn') {
        await signInWithEmail(emailTrimmed, passwordTrimmed);
        setMessage('Signed in successfully!');
        // Navigation will happen automatically via _layout.tsx
      } else {
        const result = await signUpWithEmail(emailTrimmed, passwordTrimmed);

        if (result.needsEmailConfirmation) {
          setMessage(result.message);
          // Switch to sign-in mode after showing confirmation message
          setMode('signIn');
          setPassword(''); // Clear password for security
        } else if (result.success) {
          setMessage(result.message);
          // Navigation will happen automatically
        } else {
          setError(result.message);
        }
      }
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);

      // Auto-switch to sign-in if user already exists
      if (err?.message?.includes('User already registered')) {
        setMode('signIn');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValid,
    isSubmitting,
    email,
    password,
    mode,
    signInWithEmail,
    signUpWithEmail,
    getErrorMessage,
  ]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'signIn' ? 'signUp' : 'signIn'));
    setError(null);
    setMessage(null);
  }, []);

  // Determine if button should be disabled
  const isButtonDisabled = !isValid || isSubmitting || loading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>Video-to-Recipe</Text>
              <Text style={styles.title}>Cook smarter with macros.</Text>
              <Text style={styles.subtitle}>
                Paste a link or upload a video. We turn it into a clean recipe
                with estimated calories and macros in under a minute.
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
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  placeholder="you@example.com"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                  }}
                  editable={!isSubmitting}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                      color: isDark ? '#F9FAFB' : '#111827',
                      opacity: isSubmitting ? 0.6 : 1,
                    },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  secureTextEntry
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                  placeholder="At least 6 characters"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  onSubmitEditing={submit}
                  editable={!isSubmitting}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                      color: isDark ? '#F9FAFB' : '#111827',
                      opacity: isSubmitting ? 0.6 : 1,
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
                  isButtonDisabled && styles.primaryDisabled,
                ]}
                onPress={submit}
                disabled={isButtonDisabled}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: isDark ? '#111827' : '#F9FAFB' },
                  ]}
                >
                  {isSubmitting
                    ? 'Please wait...'
                    : mode === 'signIn'
                      ? 'Sign in'
                      : 'Sign up'}
                </Text>
              </Pressable>

              <Pressable
                style={styles.switchButton}
                onPress={toggleMode}
                disabled={isSubmitting}
              >
                <Text style={[styles.switchText, isSubmitting && { opacity: 0.5 }]}>
                  {mode === 'signIn'
                    ? "Don't have an account? Create one"
                    : 'Have an account? Sign in'}
                </Text>
              </Pressable>

              <Text style={styles.helperText}>
                We use Supabase auth. Email confirmation may be required.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    lineHeight: 18,
  },
  success: {
    color: '#059669',
    fontSize: 13,
    lineHeight: 18,
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
    textAlign: 'center',
  },
});
