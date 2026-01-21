import * as React from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { API_BASE_URL } from '@/constants/api';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/components/auth';
import { useQuiz } from '@/components/quiz-state';
import { saveRecipeToLibrary } from '@/lib/recipe-library';
import { useRecipeLibrary } from '@/lib/recipe-library-context';
import { ConditionWarnings } from '@/components/ConditionWarnings';
import { analyzeRecipeForConditions } from '@/lib/dietary-guardrails';

const isWeb = Platform.OS === 'web';

export default function UploadVideoScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { user } = useAuth();
  const { quiz } = useQuiz();
  const { triggerRefresh } = useRecipeLibrary();

  const [uploading, setUploading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [message, setMessage] = React.useState('');
  const [recipe, setRecipe] = React.useState<any>(null);
  const [videoFileName, setVideoFileName] = React.useState<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Goal modification state
  const [modifiedRecipe, setModifiedRecipe] = React.useState<any>(null);
  const [isModifying, setIsModifying] = React.useState(false);
  const [modifyError, setModifyError] = React.useState<string | null>(null);

  // Save state
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

  const conditionWarnings = React.useMemo(
    () => analyzeRecipeForConditions(recipe, quiz.conditions),
    [recipe, quiz.conditions]
  );

  const modifiedConditionWarnings = React.useMemo(
    () => analyzeRecipeForConditions(modifiedRecipe?.modifiedRecipe ?? null, quiz.conditions),
    [modifiedRecipe, quiz.conditions]
  );

  const pickAndUploadVideo = async () => {
    try {
      setUploading(true);
      setStatus('uploading');
      setMessage('Selecting video...');

      // Pick video from device
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setUploading(false);
        setStatus('idle');
        setMessage('');
        return;
      }

      const file = result.assets[0];

      if (!file.uri) {
        throw new Error('No file selected');
      }

      // Store filename for later reference
      setVideoFileName(file.name || 'upload.mp4');

      console.log('[upload-video] Selected file:', {
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        uri: file.uri,
      });

      setMessage('Uploading video...');

      console.log('[upload-video] Uploading to:', `${API_BASE_URL}/api/upload-video`);
      console.log('[upload-video] File info:', {
        uri: file.uri,
        type: file.mimeType || 'video/mp4',
        name: file.name || 'upload.mp4',
        size: file.size,
        platform: Platform.OS,
      });

      let data: { jobId: string; status: string };

      if (isWeb) {
        // Web: Use fetch with FormData (file.file contains the actual File object on web)
        const formData = new FormData();

        // On web, DocumentPicker returns a file object we can use directly
        // The uri on web is a blob URL, but we need the actual File object
        const webFile = (file as any).file as File | undefined;

        if (webFile) {
          // If DocumentPicker provides the File object directly
          formData.append('video', webFile, file.name || 'upload.mp4');
        } else {
          // Fallback: fetch the blob from the URI and create a File
          const response = await fetch(file.uri);
          const blob = await response.blob();
          const videoFile = new File([blob], file.name || 'upload.mp4', {
            type: file.mimeType || 'video/mp4',
          });
          formData.append('video', videoFile);
        }

        console.log('[upload-video] Web upload using FormData');

        const uploadResponse = await fetch(`${API_BASE_URL}/api/upload-video`, {
          method: 'POST',
          body: formData,
          // Don't set Content-Type header - browser will set it with boundary
        });

        console.log('[upload-video] Web upload response:', {
          status: uploadResponse.status,
          ok: uploadResponse.ok,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          let errorMsg = 'Upload failed';
          try {
            const errorBody = JSON.parse(errorText);
            errorMsg = errorBody.error || errorMsg;
          } catch (e) {
            errorMsg = errorText || errorMsg;
          }
          throw new Error(errorMsg);
        }

        data = await uploadResponse.json();
      } else {
        // Native: Use FileSystem.uploadAsync for reliable multipart/form-data upload
        const uploadResult = await FileSystem.uploadAsync(
          `${API_BASE_URL}/api/upload-video`,
          file.uri,
          {
            fieldName: 'video',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType?.MULTIPART ?? 1, // 1 is MULTIPART enum value
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        console.log('[upload-video] Native upload result:', {
          status: uploadResult.status,
          body: uploadResult.body,
        });

        if (uploadResult.status !== 202 && uploadResult.status !== 200) {
          let errorMsg = 'Upload failed';
          try {
            const errorBody = JSON.parse(uploadResult.body);
            errorMsg = errorBody.error || errorMsg;
          } catch (e) {
            errorMsg = uploadResult.body || errorMsg;
          }
          throw new Error(errorMsg);
        }

        data = JSON.parse(uploadResult.body);
      }
      setJobId(data.jobId);
      setUploading(false);
      setProcessing(true);
      setStatus('processing');
      setMessage('Processing video...');

    } catch (err: any) {
      console.error('[upload-video] Upload failed:', err);
      setUploading(false);
      setProcessing(false);
      setStatus('error');
      setMessage(err?.message || 'Upload failed');
      Alert.alert('Upload Failed', err?.message || 'Failed to upload video');
    }
  };

  const modifyForGoal = async () => {
    if (!recipe || !user?.goal) return;

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
      conditions: quiz.conditions,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe,
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
    console.log('[upload-video] ========== SAVE BUTTON PRESSED ==========');

    if (saveStatus === 'saving') {
      console.log('[upload-video] Already saving, ignoring click');
      return;
    }
    if (!recipe) {
      console.log('[upload-video] No recipe to save');
      setSaveMessage('No recipe to save');
      setSaveStatus('error');
      return;
    }
    if (!user?.id) {
      console.log('[upload-video] No user.id, cannot save');
      setSaveMessage('Please sign in to save recipes');
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saving');
    setSaveMessage(null);

    const saveParams = {
      userId: user.id,
      title:
        modifiedRecipe?.modifiedRecipe?.title ??
        modifiedRecipe?.title ??
        recipe?.title ??
        'Uploaded Recipe',
      sourceUrl: null, // No URL for uploaded videos
      videoUrl: videoFileName ? `uploaded:${videoFileName}` : 'uploaded:video',
      goalType: modifiedRecipe?.goalType ?? user.goal ?? null,
      originalRecipe: recipe,
      modifiedRecipe: modifiedRecipe ?? undefined,
    };

    console.log('[upload-video] Save params:', {
      userId: saveParams.userId,
      title: saveParams.title,
      videoUrl: saveParams.videoUrl,
      goalType: saveParams.goalType,
      hasModifiedRecipe: !!saveParams.modifiedRecipe,
    });

    try {
      const result = await saveRecipeToLibrary(saveParams);
      console.log('[upload-video] Save SUCCESS:', result);
      setSaveStatus('saved');
      setSaveMessage('Saved to your library!');
      triggerRefresh();
    } catch (err: any) {
      console.error('[upload-video] Save FAILED:', err);
      setSaveStatus('error');
      setSaveMessage(err?.message || 'Failed to save recipe');
    }
  };

  // Reset save status when recipe changes
  React.useEffect(() => {
    if (recipe) {
      setSaveStatus('idle');
      setSaveMessage(null);
      setModifiedRecipe(null);
      setModifyError(null);
    }
  }, [recipe]);

  // Poll for job completion
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
            setMessage('Recipe generated from video!');
            setRecipe(job.result);
            setProcessing(false);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (job.status === 'failed') {
            setStatus('error');
            setMessage(job.error || 'Processing failed');
            setProcessing(false);
            if (pollRef.current) clearInterval(pollRef.current);
          } else {
            setStatus('processing');
            setMessage('Analyzing video with AI...');
          }
        })
        .catch((err) => {
          setStatus('error');
          setMessage(err.message || 'Failed to check status');
          setProcessing(false);
          if (pollRef.current) clearInterval(pollRef.current);
        });
    }, 1500);

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
          <Text style={styles.title}>Upload Cooking Video</Text>
          <Text style={styles.subtitle}>
            Upload a video from your device for high-quality recipe extraction using AI vision analysis.
          </Text>
        </View>

        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0B0F19">
          <View style={styles.infoBox} lightColor="#EFF6FF" darkColor="#1E3A8A">
            <Text style={styles.infoTitle}>Best Quality</Text>
            <Text style={styles.infoText}>
              Video upload provides the most accurate recipe extraction since the AI can analyze both audio and visual content.
            </Text>
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              (uploading || processing) && styles.primaryDisabled,
            ]}
            onPress={pickAndUploadVideo}
            disabled={uploading || processing}
          >
            {uploading ? (
              <>
                <ActivityIndicator color={isDark ? '#111827' : '#F9FAFB'} />
                <Text style={styles.primaryButtonText}>Uploading...</Text>
              </>
            ) : processing ? (
              <>
                <ActivityIndicator color={isDark ? '#111827' : '#F9FAFB'} />
                <Text style={styles.primaryButtonText}>Processing...</Text>
              </>
            ) : (
              <Text style={styles.primaryButtonText}>Choose Video from Device</Text>
            )}
          </Pressable>

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
        </View>

        {status === 'completed' && recipe ? (
          <>
            <View style={styles.resultCard} lightColor="#F9FAFB" darkColor="#0B1224">
              <Text style={styles.resultTitle}>Original Recipe</Text>
              <Text style={styles.resultSubtitle}>{recipe.title}</Text>
              <Text style={styles.resultBody}>
                {recipe.ingredients?.length ?? 0} ingredients ·{' '}
                {recipe.steps?.length ?? 0} steps
              </Text>
              <Text style={styles.resultBody}>
                Macros (est.): {recipe.macros?.calories ?? '?'} kcal · P
                {recipe.macros?.protein ?? '?'} C{recipe.macros?.carbs ?? '?'} F
                {recipe.macros?.fat ?? '?'}
              </Text>
              {conditionWarnings.length ? (
                <ConditionWarnings warnings={conditionWarnings} />
              ) : null}

              {/* Save Button */}
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
                {recipe.ingredients?.map((item: any, idx: number) => (
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
                {recipe.steps?.map((step: string, idx: number) => (
                  <View key={`step-${idx}`} style={styles.stepRow}>
                    <Text style={styles.stepNumber}>{idx + 1}</Text>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>

              {recipe.assumptions?.length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Assumptions</Text>
                  {recipe.assumptions.map((assumption: string, idx: number) => (
                    <View key={`assumption-${idx}`} style={styles.listRow}>
                      <View style={styles.bullet} />
                      <Text style={styles.listText}>{assumption}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Modify for Goal Button */}
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

            {/* Modified Recipe Card */}
            {modifiedRecipe ? (
              <View style={styles.modifiedCard} lightColor="#ECFDF5" darkColor="#0B1F1A">
                <Text style={styles.resultTitle}>
                  Optimized for {modifiedRecipe.goalType?.replace('_', ' ')}
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

                {modifiedConditionWarnings.length ? (
                  <ConditionWarnings
                    warnings={modifiedConditionWarnings}
                    title="Dietary alerts (modified)"
                  />
                ) : null}

                {/* Changes Made */}
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

                {/* Modified Ingredients */}
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
              </View>
            ) : null}

            <Pressable
              style={styles.doneButton}
              onPress={() => router.back()}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    gap: 10,
    marginBottom: 24,
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
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 16,
  },
  infoBox: {
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1E3A8A',
  },
  primaryButton: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  messageError: {
    color: '#DC2626',
  },
  messageSuccess: {
    color: '#059669',
  },
  resultCard: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    gap: 12,
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
  resultBody: {
    fontSize: 13,
    opacity: 0.8,
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
    flex: 1,
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
  doneButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  doneButtonText: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '600',
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
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    opacity: 0.7,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  modifiedCard: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  editCount: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
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
  changeCard: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeType: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.6,
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
  changeDetail: {
    fontSize: 13,
    fontWeight: '600',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  macroDelta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    marginTop: 4,
  },
});
