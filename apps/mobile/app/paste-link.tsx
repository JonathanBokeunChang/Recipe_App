import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { API_BASE_URL } from '@/constants/api';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/components/auth';
import { useQuiz } from '@/components/quiz-state';
import { saveRecipeToLibrary } from '@/lib/recipe-library';
import { useRecipeLibrary } from '@/lib/recipe-library-context';
import { logAuthState } from '@/supabaseClient';

type VideoSource = 'tiktok';

type ParseResult =
  | { ok: true; provider: VideoSource; normalizedUrl: string }
  | { ok: false; error: string };

const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
]);

function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

function parseVideoLink(input: string): ParseResult {
  const url = normalizeUrl(input);
  if (!url) {
    return { ok: false, error: 'Enter a valid URL.' };
  }

  const host = url.hostname.toLowerCase();
  const isTikTok = TIKTOK_HOSTS.has(host) || host.endsWith('.tiktok.com');
  if (!isTikTok) {
    return { ok: false, error: 'Only TikTok links are supported right now.' };
  }

  if (!url.pathname || url.pathname === '/') {
    return { ok: false, error: 'Paste the full TikTok video link.' };
  }

  url.search = '';
  url.hash = '';

  return { ok: true, provider: 'tiktok', normalizedUrl: url.toString() };
}

export default function PasteLinkScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const { quiz } = useQuiz();
  const { triggerRefresh } = useRecipeLibrary();

  const [input, setInput] = React.useState('');
  const [status, setStatus] = React.useState<
    'idle' | 'error' | 'ready' | 'processing' | 'completed'
  >('idle');
  const [message, setMessage] = React.useState('');
  const [normalizedUrl, setNormalizedUrl] = React.useState<string | null>(null);
  const [provider, setProvider] = React.useState<VideoSource | null>(null);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [resultPreview, setResultPreview] = React.useState<any>(null);
  const [modifiedRecipe, setModifiedRecipe] = React.useState<any>(null);
  const [isModifying, setIsModifying] = React.useState(false);
  const [modifyError, setModifyError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const validate = () => {
    const result = parseVideoLink(input);
    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      setNormalizedUrl(null);
      setProvider(null);
      return;
    }

    setStatus('ready');
    setMessage('TikTok link detected. Ready to start processing.');
    setNormalizedUrl(result.normalizedUrl);
    setProvider(result.provider);
  };

  const submit = () => {
    const result = parseVideoLink(input);
    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      setNormalizedUrl(null);
      setProvider(null);
      return;
    }

    setStatus('processing');
    setMessage('Sending to backend…');
    setNormalizedUrl(result.normalizedUrl);
    setProvider(result.provider);
    setResultPreview(null);
    setModifiedRecipe(null);
    setSaveStatus('idle');
    setSaveMessage(null);

    fetch(`${API_BASE_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: result.normalizedUrl }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to queue job');
        }
        return res.json();
      })
      .then((data) => {
        setJobId(data.jobId);
        setMessage('Queued for processing…');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Failed to queue job');
      });
  };

  const modifyForGoal = async () => {
    if (!resultPreview || !user?.goal) return;

    setIsModifying(true);
    setModifyError(null);
    setModifiedRecipe(null);
    const userContext = {
      biologicalSex: quiz.biologicalSex,
      age: quiz.age,
      heightCm: quiz.heightCm,
      weightKg: quiz.weightKg,
      goalWeightKg: quiz.goalWeightKg,
      activityLevel: quiz.activityLevel,
      dietStyle: quiz.dietStyle,
      allergens: quiz.allergens,
      avoidList: quiz.avoidList,
      pace: quiz.pace,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe: resultPreview,
          goalType: user.goal,
          userContext,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to modify recipe');
      }

      const data = await response.json();
      setModifiedRecipe(data);
    } catch (err: any) {
      setModifyError(err.message || 'Failed to modify recipe');
    } finally {
      setIsModifying(false);
    }
  };

  const saveRecipe = async () => {
    console.log('[paste-link] ========== SAVE BUTTON PRESSED ==========');
    console.log('[paste-link] Current state:', {
      saveStatus,
      hasResultPreview: !!resultPreview,
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      hasModifiedRecipe: !!modifiedRecipe,
    });

    // Prevent double-clicks while actively saving
    if (saveStatus === 'saving') {
      console.log('[paste-link] Already saving, ignoring click');
      return;
    }
    if (!resultPreview) {
      console.log('[paste-link] No resultPreview, cannot save');
      setSaveMessage('No recipe to save');
      setSaveStatus('error');
      return;
    }
    if (!user?.id) {
      console.log('[paste-link] No user.id, cannot save');
      setSaveMessage('Please sign in to save recipes');
      setSaveStatus('error');
      return;
    }

    // Reset to saving state (allows re-saving) before any network calls
    setSaveStatus('saving');
    setSaveMessage(null);
    console.log('[paste-link] Set status to saving, starting save...');

    // Check actual Supabase auth state before saving (fire-and-forget so UI is responsive)
    logAuthState('save-button-pressed').catch((err) => {
      console.error('[paste-link] logAuthState failed:', err);
    });

    // Log what we're about to save
    const saveParams = {
      userId: user.id,
      title:
        modifiedRecipe?.modifiedRecipe?.title ??
        modifiedRecipe?.title ??
        resultPreview?.title ??
        'Recipe',
      sourceUrl: normalizedUrl ?? input,
      videoUrl: normalizedUrl ?? input,
      goalType: modifiedRecipe?.goalType ?? user.goal ?? null,
      originalRecipe: resultPreview,
      modifiedRecipe: modifiedRecipe ?? undefined,
    };

    console.log('[paste-link] Save params:', {
      userId: saveParams.userId,
      title: saveParams.title,
      sourceUrl: saveParams.sourceUrl,
      videoUrl: saveParams.videoUrl,
      goalType: saveParams.goalType,
      originalRecipeTitle: saveParams.originalRecipe?.title,
      originalRecipeIngredientCount: saveParams.originalRecipe?.ingredients?.length,
      hasModifiedRecipe: !!saveParams.modifiedRecipe,
    });

    try {
      console.log('[paste-link] Calling saveRecipeToLibrary...');
      const startTime = Date.now();
      const result = await saveRecipeToLibrary(saveParams);
      const duration = Date.now() - startTime;
      console.log('[paste-link] saveRecipeToLibrary returned in', duration, 'ms');
      console.log('[paste-link] Result:', result);

      setSaveStatus('saved');
      setSaveMessage('Saved to your library.');
      console.log('[paste-link] Save SUCCESS!');
      triggerRefresh();
    } catch (err: any) {
      console.error('[paste-link] Save FAILED:', err);
      console.error('[paste-link] Error details:', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      });
      setSaveStatus('error');
      setSaveMessage(err?.message || 'Failed to save recipe');
    }

    console.log('[paste-link] ========== SAVE COMPLETE ==========');
  };

  // Reset save status when a new recipe is loaded or when modified recipe changes
  // Use a stable reference to detect actual content changes
  const recipeKey = React.useMemo(() => {
    if (!resultPreview) return null;
    return JSON.stringify({
      title: resultPreview.title,
      ingredientCount: resultPreview.ingredients?.length,
      modified: modifiedRecipe ? {
        goalType: modifiedRecipe.goalType,
        editCount: modifiedRecipe.edits?.length,
      } : null,
    });
  }, [resultPreview, modifiedRecipe]);

  React.useEffect(() => {
    console.log('[paste-link] recipeKey changed, resetting save status to idle');
    setSaveStatus('idle');
    setSaveMessage(null);
  }, [recipeKey]);

  // Debug: log when user changes
  React.useEffect(() => {
    console.log('[paste-link] user changed:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
    });
  }, [user]);

  React.useEffect(() => {
    if (!jobId) return;
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(() => {
      fetch(`${API_BASE_URL}/api/jobs/${jobId}`)
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to fetch job status');
          return res.json();
        })
        .then((job) => {
          if (job.status === 'completed') {
            setStatus('completed');
            setMessage('Recipe generated.');
            setResultPreview(job.result);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (job.status === 'failed') {
            setStatus('error');
            setMessage(job.error || 'Processing failed.');
            if (pollRef.current) clearInterval(pollRef.current);
          } else {
            setStatus('processing');
            setMessage('Processing…');
          }
        })
        .catch((err) => {
          setStatus('error');
          setMessage(err.message || 'Failed to fetch job status');
          if (pollRef.current) clearInterval(pollRef.current);
        });
    }, 1200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Paste a video link</Text>
          <Text style={styles.subtitle}>
            We currently support TikTok links. If extraction fails, we will prompt you to
            upload the video.
          </Text>
        </View>

        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0B0F19">
          <Text style={styles.label}>Video link</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://www.tiktok.com/@creator/video/123"
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                color: isDark ? '#F9FAFB' : '#111827',
              },
            ]}
            value={input}
            onChangeText={(text) => {
              setInput(text);
              setStatus('idle');
              setMessage('');
              setNormalizedUrl(null);
              setProvider(null);
            }}
          />

          <Pressable style={styles.secondaryButton} onPress={validate}>
            <Text style={styles.secondaryButtonText}>Check link</Text>
          </Pressable>

          {provider && normalizedUrl ? (
            <View style={styles.preview}>
              <View style={styles.badge} lightColor="#ECFEFF" darkColor="#0F172A">
                <Text style={styles.badgeText}>TikTok</Text>
              </View>
              <Text style={styles.previewText}>{normalizedUrl}</Text>
            </View>
          ) : null}

          {message ? (
            <Text
              style={[
                styles.message,
                status === 'error' ? styles.messageError : styles.messageSuccess,
              ]}
            >
              {message}
            </Text>
          ) : null}

          <Pressable
            style={[styles.primaryButton, status === 'processing' && styles.primaryDisabled]}
            onPress={submit}
            disabled={status === 'processing'}
          >
            {status === 'processing' ? (
              <ActivityIndicator color={isDark ? '#111827' : '#F9FAFB'} />
            ) : (
              <Text style={styles.primaryButtonText}>Start processing</Text>
            )}
          </Pressable>
        </View>

        {status === 'completed' && resultPreview ? (
          <>
            <View style={styles.resultCard} lightColor="#F9FAFB" darkColor="#0B1224">
              <Text style={styles.resultTitle}>Original Recipe</Text>
              <Text style={styles.resultSubtitle}>{resultPreview.title}</Text>
              <Text style={styles.resultBody}>
                {resultPreview.ingredients?.length ?? 0} ingredients ·{' '}
                {resultPreview.steps?.length ?? 0} steps
              </Text>
              <Text style={styles.resultBody}>
                Macros (est.): {resultPreview.macros?.calories ?? '?'} kcal · P
                {resultPreview.macros?.protein ?? '?'} C{resultPreview.macros?.carbs ?? '?'} F
                {resultPreview.macros?.fat ?? '?'}
              </Text>
              <View style={styles.section}>
                <Pressable
                  style={[
                    styles.saveButton,
                    saveStatus === 'saving' && styles.primaryDisabled,
                  ]}
                  onPress={saveRecipe}
                  disabled={saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? (
                    <ActivityIndicator color="#F9FAFB" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {saveStatus === 'saved' ? 'Save again' : 'Save to library'}
                    </Text>
                  )}
                </Pressable>
                {saveMessage ? (
                  <Text
                    style={[
                      styles.saveMessage,
                      saveStatus === 'error' && styles.saveMessageError,
                    ]}
                  >
                    {saveMessage}
                  </Text>
                ) : null}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                {resultPreview.ingredients?.map((item: any, idx: number) => (
                  <View key={`${item.name}-${idx}`} style={styles.listRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.listText}>
                      {item.quantity ? `${item.quantity} ` : ''}
                      {item.name}
                    </Text>
                  </View>
                ))}
              </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Steps</Text>
              {resultPreview.steps?.map((step: string, idx: number) => (
                <View key={`step-${idx}`} style={styles.stepRow}>
                  <Text style={styles.stepNumber}>{idx + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

              {resultPreview.assumptions?.length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Assumptions</Text>
                  {resultPreview.assumptions.map((assumption: string, idx: number) => (
                    <View key={`assumption-${idx}`} style={styles.listRow}>
                      <View style={styles.bullet} />
                      <Text style={styles.listText}>{assumption}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {user?.goal && !modifiedRecipe ? (
                <View style={styles.section}>
                  <Pressable
                    style={[styles.modifyButton, isModifying && styles.primaryDisabled]}
                    onPress={modifyForGoal}
                    disabled={isModifying}
                  >
                    {isModifying ? (
                      <ActivityIndicator color="#F9FAFB" />
                    ) : (
                      <Text style={styles.modifyButtonText}>
                        Modify for {user.goal.replace('_', ' ')} goal
                      </Text>
                    )}
                  </Pressable>
                  {modifyError ? (
                    <Text style={styles.errorText}>{modifyError}</Text>
                  ) : null}
                </View>
              ) : null}

              {!user?.goal ? (
                <View style={styles.section}>
                  <Text style={styles.warningText}>
                    Select a goal on the Home tab to get AI-powered recipe modifications
                  </Text>
                </View>
              ) : null}
            </View>

            {modifiedRecipe ? (
              <View style={styles.resultCard} lightColor="#ECFDF5" darkColor="#0B1F1A">
                <Text style={styles.resultTitle}>
                  Optimized for {modifiedRecipe.goalType.replace('_', ' ')}
                </Text>
                <Text style={styles.editCount}>
                  {modifiedRecipe.edits?.length || 0} targeted edit{modifiedRecipe.edits?.length !== 1 ? 's' : ''}
                </Text>

                {/* Macro Comparison */}
                <View style={styles.macroComparison}>
                  <View style={styles.macroColumn}>
                    <Text style={styles.macroLabel}>Original</Text>
                    <Text style={styles.macroValue}>
                      {modifiedRecipe.summary?.originalMacros?.calories ?? '?'} cal
                    </Text>
                    <Text style={styles.macroValue}>
                      P {modifiedRecipe.summary?.originalMacros?.protein ?? '?'}g
                    </Text>
                    <Text style={styles.macroValue}>
                      C {modifiedRecipe.summary?.originalMacros?.carbs ?? '?'}g
                    </Text>
                    <Text style={styles.macroValue}>
                      F {modifiedRecipe.summary?.originalMacros?.fat ?? '?'}g
                    </Text>
                  </View>
                  <Text style={styles.macroArrow}>→</Text>
                  <View style={styles.macroColumn}>
                    <Text style={styles.macroLabel}>Modified</Text>
                    <Text style={styles.macroValue}>
                      {modifiedRecipe.summary?.newMacros?.calories ?? '?'} cal
                    </Text>
                    <Text style={styles.macroValue}>
                      P {modifiedRecipe.summary?.newMacros?.protein ?? '?'}g
                    </Text>
                    <Text style={styles.macroValue}>
                      C {modifiedRecipe.summary?.newMacros?.carbs ?? '?'}g
                    </Text>
                    <Text style={styles.macroValue}>
                      F {modifiedRecipe.summary?.newMacros?.fat ?? '?'}g
                    </Text>
                  </View>
                </View>

                {/* Top Macro Drivers */}
                {modifiedRecipe.analysis?.topMacroDrivers?.length ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Top Macro Drivers</Text>
                    {modifiedRecipe.analysis.topMacroDrivers.map((driver: any, idx: number) => (
                      <View key={`driver-${idx}`} style={styles.driverCard}>
                        <Text style={styles.driverIngredient}>{driver.ingredient}</Text>
                        <Text style={styles.driverContribution}>{driver.contribution}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Edits Made */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Changes Made</Text>
                  {modifiedRecipe.edits?.map((edit: any, idx: number) => (
                    <View key={`edit-${idx}`} style={styles.changeCard}>
                      <View style={styles.editHeader}>
                        <Text style={styles.changeType}>{edit.lever?.replace(/_/g, ' ')}</Text>
                        <View style={styles.scoreRow}>
                          <Text style={styles.scoreLabel}>Taste: {edit.tasteScore}/5</Text>
                          <Text style={styles.scoreLabel}>Texture: {edit.textureScore}/5</Text>
                        </View>
                      </View>
                      <Text style={styles.changeDetail}>
                        <Text style={styles.strikethrough}>{edit.original}</Text> → {edit.modified}
                      </Text>
                      {edit.macroDelta ? (
                        <Text style={styles.macroDelta}>
                          {edit.macroDelta.calories ? `${edit.macroDelta.calories > 0 ? '+' : ''}${edit.macroDelta.calories} cal` : ''}
                          {edit.macroDelta.protein ? ` P${edit.macroDelta.protein > 0 ? '+' : ''}${edit.macroDelta.protein}` : ''}
                          {edit.macroDelta.carbs ? ` C${edit.macroDelta.carbs > 0 ? '+' : ''}${edit.macroDelta.carbs}` : ''}
                          {edit.macroDelta.fat ? ` F${edit.macroDelta.fat > 0 ? '+' : ''}${edit.macroDelta.fat}` : ''}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>

                {/* Step Updates (only show if there are changes) */}
                {modifiedRecipe.stepUpdates?.length ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Updated Steps</Text>
                    {modifiedRecipe.stepUpdates.map((update: any, idx: number) => (
                      <View key={`step-update-${idx}`} style={styles.stepUpdateCard}>
                        <Text style={styles.stepUpdateNumber}>Step {update.stepNumber}</Text>
                        <Text style={styles.stepUpdateText}>{update.modified}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Warnings */}
                {modifiedRecipe.warnings?.length ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    {modifiedRecipe.warnings.map((warning: string, idx: number) => (
                      <View key={`warning-${idx}`} style={styles.listRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.warningText}>{warning}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Modified Recipe - Full Ingredients */}
                {modifiedRecipe.modifiedRecipe?.ingredients?.length ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Modified Ingredients</Text>
                    {modifiedRecipe.modifiedRecipe.ingredients.map((item: any, idx: number) => (
                      <View key={`mod-ing-${idx}`} style={styles.listRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.listText}>
                          {item.quantity ? `${item.quantity} ` : ''}
                          {item.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Modified Recipe - Full Steps */}
                {modifiedRecipe.modifiedRecipe?.steps?.length ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Modified Steps</Text>
                    {modifiedRecipe.modifiedRecipe.steps.map((step: string, idx: number) => (
                      <View key={`mod-step-${idx}`} style={styles.stepRow}>
                        <Text style={styles.stepNumber}>{idx + 1}</Text>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
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
    paddingTop: 24,
  },
  header: {
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.75,
  },
  card: {
    marginTop: 24,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#111827',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  preview: {
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewText: {
    fontSize: 12,
    opacity: 0.7,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageError: {
    color: '#DC2626',
  },
  messageSuccess: {
    color: '#059669',
  },
  primaryButton: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  resultSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.9,
  },
  editCount: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
  },
  resultBody: {
    fontSize: 13,
    opacity: 0.8,
  },
  saveButton: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '600',
  },
  saveMessage: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.75,
  },
  saveMessageError: {
    color: '#DC2626',
    opacity: 1,
  },
  modifyButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modifyButtonText: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 12,
    opacity: 0.7,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 8,
  },
  macroComparison: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  macroColumn: {
    gap: 4,
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.6,
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  macroArrow: {
    fontSize: 20,
    fontWeight: '700',
    opacity: 0.5,
  },
  reasoningText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.85,
  },
  changeCard: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  changeType: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  changeDetail: {
    fontSize: 13,
    fontWeight: '600',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  changeReason: {
    fontSize: 12,
    opacity: 0.7,
    lineHeight: 18,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
  },
  macroDelta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    marginTop: 4,
  },
  driverCard: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 10,
    borderRadius: 8,
    gap: 2,
  },
  driverIngredient: {
    fontSize: 13,
    fontWeight: '600',
  },
  driverContribution: {
    fontSize: 11,
    opacity: 0.7,
  },
  stepUpdateCard: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  stepUpdateNumber: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.6,
  },
  stepUpdateText: {
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    marginTop: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4B5563',
  },
  listText: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepNumber: {
    width: 20,
    textAlign: 'center',
    fontWeight: '700',
    color: '#111827',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.95,
  },
});
