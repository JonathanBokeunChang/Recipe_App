import * as React from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { API_BASE_URL } from '@/constants/api';
import { useAuth } from '@/components/auth';
import { useQuiz } from '@/components/quiz-state';
import { saveRecipeToLibrary } from '@/lib/recipe-library';
import { useRecipeLibrary } from '@/lib/recipe-library-context';
import { ConditionWarnings } from '@/components/ConditionWarnings';
import { analyzeRecipeForConditions } from '@/lib/dietary-guardrails';
import { PALETTE } from '@/constants/palette';

const isWeb = Platform.OS === 'web';

export default function UploadRecipeImageScreen() {
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
  const [imageFileName, setImageFileName] = React.useState<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const [modifiedRecipe, setModifiedRecipe] = React.useState<any>(null);
  const [isModifying, setIsModifying] = React.useState(false);
  const [modifyError, setModifyError] = React.useState<string | null>(null);

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

  const pickAndUploadImage = async () => {
    try {
      setUploading(true);
      setStatus('uploading');
      setMessage('Selecting image...');

      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
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

      setImageFileName(file.name || 'recipe-image');

      setMessage('Uploading recipe image...');

      let data: { jobId: string; status: string };

      if (isWeb) {
        const formData = new FormData();
        const webFile = (file as any).file as File | undefined;

        if (webFile) {
          formData.append('image', webFile, file.name || 'recipe.jpg');
        } else {
          const response = await fetch(file.uri);
          const blob = await response.blob();
          const uploadFile = new File([blob], file.name || 'recipe.jpg', {
            type: file.mimeType || 'image/jpeg',
          });
          formData.append('image', uploadFile);
        }

        const uploadResponse = await fetch(`${API_BASE_URL}/api/upload-recipe-image`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          let errorMsg = 'Upload failed';
          try {
            const errorBody = JSON.parse(errorText);
            errorMsg = errorBody.error || errorMsg;
          } catch {
            errorMsg = errorText || errorMsg;
          }
          throw new Error(errorMsg);
        }

        data = await uploadResponse.json();
      } else {
        const uploadResult = await FileSystem.uploadAsync(
          `${API_BASE_URL}/api/upload-recipe-image`,
          file.uri,
          {
            fieldName: 'image',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType?.MULTIPART ?? 1,
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (uploadResult.status !== 202 && uploadResult.status !== 200) {
          let errorMsg = 'Upload failed';
          try {
            const errorBody = JSON.parse(uploadResult.body);
            errorMsg = errorBody.error || errorMsg;
          } catch {
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
      setMessage('Processing recipe image...');
      setRecipe(null);
      setModifiedRecipe(null);
    } catch (err: any) {
      console.error('[upload-image] Upload failed:', err);
      setUploading(false);
      setProcessing(false);
      setStatus('error');
      setMessage(err?.message || 'Upload failed');
      Alert.alert('Upload Failed', err?.message || 'Failed to upload image');
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
    if (saveStatus === 'saving') return;
    if (!recipe) {
      setSaveMessage('No recipe to save');
      setSaveStatus('error');
      return;
    }
    if (!user?.id) {
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
        'Scanned Recipe',
      sourceUrl: null,
      videoUrl: imageFileName ? `recipe-image:${imageFileName}` : 'recipe-image:upload',
      goalType: modifiedRecipe?.goalType ?? user.goal ?? null,
      originalRecipe: recipe,
      modifiedRecipe: modifiedRecipe ?? undefined,
    };

    try {
      const result = await saveRecipeToLibrary(saveParams);
      console.log('[upload-image] Save SUCCESS:', result);
      setSaveStatus('saved');
      setSaveMessage('Saved to your library!');
      triggerRefresh();
    } catch (err: any) {
      console.error('[upload-image] Save FAILED:', err);
      setSaveStatus('error');
      setSaveMessage(err?.message || 'Failed to save recipe');
    }
  };

  React.useEffect(() => {
    if (recipe) {
      setSaveStatus('idle');
      setSaveMessage(null);
      setModifiedRecipe(null);
      setModifyError(null);
    }
  }, [recipe]);

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
            setMessage('Recipe generated from your image!');
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
            setMessage('Analyzing image with AI...');
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Scan Recipe Photo</Text>
          <Text style={styles.subtitle}>
            Upload a handwritten or typed recipe image. Gemini will read it, turn it into an editable recipe, and estimate macros.
          </Text>
        </View>

        <View
          style={styles.card}
          lightColor={PALETTE.surface}
          darkColor={PALETTE.surface}
        >
          <View
            style={styles.infoBox}
            lightColor={PALETTE.surfaceAlt}
            darkColor={PALETTE.surfaceAlt}
          >
            <Text style={styles.infoTitle}>Tip for clarity</Text>
            <Text style={styles.infoText}>
              Use a well-lit photo with the full page in frame. Include both the ingredient list and steps if possible.
            </Text>
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              (uploading || processing) && styles.primaryDisabled,
            ]}
            onPress={pickAndUploadImage}
            disabled={uploading || processing}
          >
            {uploading ? (
              <>
                <ActivityIndicator color={PALETTE.background} />
                <Text style={styles.primaryButtonText}>Uploading...</Text>
              </>
            ) : processing ? (
              <>
                <ActivityIndicator color={PALETTE.background} />
                <Text style={styles.primaryButtonText}>Processing...</Text>
              </>
            ) : (
              <Text style={styles.primaryButtonText}>Choose Recipe Image</Text>
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
            <View
              style={styles.resultCard}
              lightColor={PALETTE.surfaceAlt}
              darkColor={PALETTE.surfaceAlt}
            >
              <Text style={styles.resultTitle}>Recipe Draft</Text>
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
                    <ActivityIndicator color={PALETTE.text} />
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

              {user?.goal && !modifiedRecipe ? (
                <View style={styles.section}>
                  <Pressable
                    style={[styles.modifyButton, isModifying && styles.primaryDisabled]}
                    onPress={modifyForGoal}
                    disabled={isModifying}
                  >
                    {isModifying ? (
                      <ActivityIndicator color="#1b1200" />
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
              <View
                style={styles.modifiedCard}
                lightColor={PALETTE.surface}
                darkColor={PALETTE.surface}
              >
                <Text style={styles.resultTitle}>
                  Optimized for {modifiedRecipe.goalType?.replace('_', ' ')}
                </Text>
                <Text style={styles.editCount}>
                  {modifiedRecipe.edits?.length || 0} targeted edit{modifiedRecipe.edits?.length !== 1 ? 's' : ''}
                </Text>

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

            <Pressable style={styles.doneButton} onPress={() => router.back()}>
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
    backgroundColor: PALETTE.background,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    backgroundColor: PALETTE.background,
  },
  header: {
    gap: 10,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: PALETTE.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: PALETTE.mutedText,
  },
  card: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 16,
    backgroundColor: PALETTE.surface,
  },
  infoBox: {
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surfaceAlt,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: PALETTE.accentCyan,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.mutedText,
  },
  primaryButton: {
    backgroundColor: PALETTE.accent,
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
    color: '#031305',
    fontSize: 16,
    fontWeight: '800',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: PALETTE.mutedText,
  },
  messageError: {
    color: PALETTE.danger,
  },
  messageSuccess: {
    color: PALETTE.accent,
  },
  resultCard: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surfaceAlt,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: PALETTE.text,
  },
  resultSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.text,
  },
  resultBody: {
    fontSize: 13,
    color: PALETTE.mutedText,
  },
  section: {
    marginTop: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: PALETTE.text,
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
    backgroundColor: PALETTE.accent,
  },
  listText: {
    fontSize: 13,
    lineHeight: 18,
    color: PALETTE.text,
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
    color: PALETTE.accent,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.text,
  },
  saveButton: {
    backgroundColor: PALETTE.surfaceAlt,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: PALETTE.text,
    fontSize: 15,
    fontWeight: '700',
  },
  saveMessage: {
    fontSize: 12,
    marginTop: 4,
    color: PALETTE.mutedText,
  },
  saveMessageError: {
    color: PALETTE.danger,
    opacity: 1,
  },
  modifyButton: {
    backgroundColor: PALETTE.accentSecondary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modifyButtonText: {
    color: '#1b1200',
    fontSize: 15,
    fontWeight: '700',
  },
  warningText: {
    fontSize: 12,
    color: PALETTE.mutedText,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  modifiedCard: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
  },
  editCount: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.mutedText,
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
    color: PALETTE.mutedText,
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.text,
  },
  macroArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: PALETTE.mutedText,
  },
  changeCard: {
    backgroundColor: PALETTE.surfaceAlt,
    padding: 12,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: PALETTE.border,
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
    color: PALETTE.mutedText,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: PALETTE.mutedText,
  },
  changeDetail: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.text,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: PALETTE.mutedText,
  },
  macroDelta: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.accent,
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    color: PALETTE.danger,
    marginTop: 8,
  },
  doneButton: {
    backgroundColor: PALETTE.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  doneButtonText: {
    color: '#031305',
    fontSize: 15,
    fontWeight: '800',
  },
});
