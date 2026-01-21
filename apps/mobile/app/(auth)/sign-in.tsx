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
import { useAuth } from '@/components/auth';
import { PALETTE } from '@/constants/palette';

type FormMode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<FormMode>('signIn');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    setError(null);
    setMessage(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [signInWithGoogle]);

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

            <View
              style={styles.card}
              lightColor={PALETTE.surface}
              darkColor={PALETTE.surface}
            >
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
                  placeholderTextColor={PALETTE.mutedText}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                  }}
                  editable={!isSubmitting}
                  style={[
                    styles.input,
                    { opacity: isSubmitting ? 0.6 : 1 },
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
                  placeholderTextColor={PALETTE.mutedText}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  onSubmitEditing={submit}
                  editable={!isSubmitting}
                  style={[
                    styles.input,
                    { opacity: isSubmitting ? 0.6 : 1 },
                  ]}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}

              <Pressable
                style={[styles.primaryButton, isButtonDisabled && styles.primaryDisabled]}
                onPress={submit}
                disabled={isButtonDisabled}
              >
                <Text style={styles.primaryButtonText}>
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

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={[
                  styles.googleButton,
                  { backgroundColor: PALETTE.surfaceAlt },
                  (googleLoading || loading) && styles.buttonDisabled,
                ]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading || loading || isSubmitting}
              >
                <Text style={styles.googleButtonText}>
                  {googleLoading ? 'Signing in...' : 'Continue with Google'}
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
    backgroundColor: PALETTE.background,
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
    backgroundColor: PALETTE.background,
  },
  hero: {
    gap: 12,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: PALETTE.accent,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    color: PALETTE.text,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: PALETTE.mutedText,
  },
  card: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: PALETTE.text,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: PALETTE.mutedText,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.mutedText,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surfaceAlt,
    color: PALETTE.text,
  },
  error: {
    color: PALETTE.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  success: {
    color: PALETTE.accent,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: PALETTE.accent,
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#031305',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.text,
  },
  helperText: {
    fontSize: 12,
    color: PALETTE.mutedText,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: PALETTE.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: PALETTE.mutedText,
  },
  googleButton: {
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.text,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
