import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { QuizState, useQuiz } from '@/components/quiz-state';

type StepKey = 'profile' | 'body' | 'goal' | 'diet';

const activityOptions = [
  { value: 'sedentary', label: 'Sedentary', note: 'Desk work, little exercise' },
  { value: 'light', label: 'Lightly active', note: '1-2 short workouts/week' },
  { value: 'moderate', label: 'Moderately active', note: '3-4 workouts or 8k+ steps' },
  { value: 'active', label: 'Active', note: 'Manual work or 5 workouts/week' },
  { value: 'very_active', label: 'Very active', note: 'Athletic training, double days' },
];

const goalOptions = [
  { value: 'bulk', label: 'Bulk', note: 'Faster gain, larger surplus' },
  { value: 'lean_bulk', label: 'Lean bulk', note: 'Slow gain with tighter surplus' },
  { value: 'maintain', label: 'Maintain', note: 'Steady energy balance' },
  { value: 'cut', label: 'Cut', note: 'Controlled deficit for fat loss' },
];

const paceOptions = [
  { value: 1, label: 'Gentle', note: 'Minimal change, safest' },
  { value: 2, label: 'Steady', note: 'Gradual adjustments' },
  { value: 3, label: 'Balanced', note: 'Default' },
  { value: 4, label: 'Fast', note: 'Quicker shifts, more hunger risk' },
  { value: 5, label: 'Aggressive', note: 'Max change, short bursts only' },
];

const dietOptions = [
  { value: 'none', label: 'No preference' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
];

const allergenOptions = ['nuts', 'dairy', 'shellfish', 'gluten', 'soy', 'eggs', 'sesame'];

function kgToLb(kg: number) {
  return kg * 2.20462;
}

function lbToKg(lb: number) {
  return lb / 2.20462;
}

function cmToImperial(cm: number) {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return { feet, inches };
}

function imperialToCm(feet: number, inches: number) {
  return Math.round((feet * 12 + inches) * 2.54);
}

export default function QuizScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { quiz, status, saving, updateQuiz, completeQuiz, skipQuiz } = useQuiz();
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const steps: StepKey[] = ['profile', 'body', 'goal', 'diet'];
  const currentStep = steps[stepIndex];
  const progressPct = ((stepIndex + 1) / steps.length) * 100;

  const paceLabel = useMemo(() => {
    return paceOptions.find((p) => p.value === quiz.pace)?.note ?? 'Balanced';
  }, [quiz.pace]);

  // Debug logging for quiz flow
  console.log('[quiz-screen] Render', {
    currentStep,
    stepIndex,
    quizStatus: status,
    isStepValid: Boolean(currentStep === 'profile' ? quiz.biologicalSex && quiz.age && quiz.age >= 13 :
      currentStep === 'body' ? quiz.heightCm && quiz.weightKg :
      currentStep === 'goal' ? quiz.goal && quiz.activityLevel : true),
    saving,
    submitting,
  });

  const isStepValid = useMemo(() => {
    if (currentStep === 'profile') {
      return Boolean(quiz.biologicalSex && quiz.age && quiz.age >= 13);
    }
    if (currentStep === 'body') {
      return Boolean(quiz.heightCm && quiz.weightKg);
    }
    if (currentStep === 'goal') {
      return Boolean(quiz.goal && quiz.activityLevel);
    }
    return true;
  }, [currentStep, quiz]);

  const goNext = async () => {
    console.log('[quiz-screen] goNext called', {
      stepIndex,
      isStepValid,
      saving,
      submitting,
      quizState: quiz,
    });

    if (saving || submitting) {
      console.log('[quiz-screen] Blocked - saving/submitting in progress');
      return;
    }

    if (stepIndex === steps.length - 1) {
      try {
        setSubmitting(true);
        console.log('[quiz-screen] Calling completeQuiz...');
        await completeQuiz();
        console.log('[quiz-screen] completeQuiz finished successfully');
        console.log('[quiz-screen] Waiting 100ms for state propagation...');
        // Small delay to ensure state propagation before navigation
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('[quiz-screen] About to call router.replace("/(tabs)")');
        router.replace('/(tabs)');
        console.log('[quiz-screen] router.replace("/(tabs)") called - navigation should happen now');
      } catch (err: any) {
        console.log('[quiz-screen] completeQuiz error:', err);
        // Provide more helpful error messages based on error type
        let title = 'Could not save quiz';
        let message = 'Please try again.';

        if (err?.message?.includes('timed out') || err?.message?.includes('timeout')) {
          title = 'Connection slow';
          message = 'The save is taking longer than expected. Please check your internet connection and try again.';
        } else if (err?.message?.includes('not authenticated')) {
          title = 'Session expired';
          message = 'Please sign in again to continue.';
        } else if (err?.message?.includes('RLS policy')) {
          title = 'Permission denied';
          message = 'Unable to save your profile. Please try signing out and back in.';
        } else if (err?.message) {
          message = err.message;
        }

        Alert.alert(title, message, [
          { text: 'OK', style: 'default' }
        ]);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setStepIndex((idx) => Math.min(idx + 1, steps.length - 1));
  };

  const goBack = () => setStepIndex((idx) => Math.max(idx - 1, 0));

  const handleSkip = async () => {
    if (saving || submitting) return; // Prevent double-submit

    try {
      setSubmitting(true);
      await skipQuiz();
      // Small delay to ensure state propagation before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      router.replace('/(tabs)');
    } catch (err: any) {
      console.log('[quiz-screen] skipQuiz error:', err);
      let title = 'Could not skip quiz';
      let message = 'Please try again.';

      if (err?.message?.includes('timed out') || err?.message?.includes('timeout')) {
        title = 'Connection slow';
        message = 'Please check your internet connection and try again.';
      } else if (err?.message?.includes('not authenticated')) {
        title = 'Session expired';
        message = 'Please sign in again to continue.';
      } else if (err?.message) {
        message = err.message;
      }

      Alert.alert(title, message, [
        { text: 'OK', style: 'default' }
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const setWeightWithUnit = (text: string) => {
    const num = parseFloat(text);
    if (Number.isFinite(num)) {
      const weightKg = quiz.weightUnit === 'kg' ? num : lbToKg(num);
      updateQuiz({ weightKg });
    } else {
      updateQuiz({ weightKg: null });
    }
  };

  const setGoalWeightWithUnit = (text: string) => {
    const num = parseFloat(text);
    if (Number.isFinite(num)) {
      const goalWeightKg = quiz.weightUnit === 'kg' ? num : lbToKg(num);
      updateQuiz({ goalWeightKg });
    } else {
      updateQuiz({ goalWeightKg: null });
    }
  };

  const handleWeightUnitChange = (unit: 'kg' | 'lb') => {
    if (unit === quiz.weightUnit) return;
    updateQuiz({ weightUnit: unit });
  };

  const handleHeightUnitChange = (unit: 'cm' | 'imperial') => {
    if (unit === quiz.heightUnit) return;
    if (unit === 'imperial' && quiz.heightCm) {
      const { feet, inches } = cmToImperial(quiz.heightCm);
      updateQuiz({ heightUnit: unit, heightFeet: feet, heightInches: inches });
    } else if (unit === 'cm' && quiz.heightFeet != null && quiz.heightInches != null) {
      const cm = imperialToCm(quiz.heightFeet, quiz.heightInches);
      updateQuiz({ heightUnit: unit, heightCm: cm });
    } else {
      updateQuiz({ heightUnit: unit });
    }
  };

  const setHeightCm = (text: string) => {
    const num = parseFloat(text);
    if (Number.isFinite(num)) {
      const { feet, inches } = cmToImperial(num);
      updateQuiz({ heightCm: num, heightFeet: feet, heightInches: inches });
    } else {
      updateQuiz({ heightCm: null });
    }
  };

  const setHeightImperial = (feet: string, inches: string) => {
    const ft = parseInt(feet, 10);
    const inch = parseInt(inches, 10);
    const partial: Partial<QuizState> = {
      heightUnit: 'imperial',
      heightFeet: Number.isFinite(ft) ? ft : null,
      heightInches: Number.isFinite(inch) ? inch : null,
    };

    if (Number.isFinite(ft) && Number.isFinite(inch)) {
      partial.heightCm = imperialToCm(ft, inch);
    } else {
      partial.heightCm = null;
    }

    updateQuiz(partial);
  };

  const toggleAllergen = (value: string) => {
    const exists = quiz.allergens.includes(value);
    const next = exists ? quiz.allergens.filter((a) => a !== value) : [...quiz.allergens, value];
    updateQuiz({ allergens: next });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Text style={styles.progressLabel}>Step {stepIndex + 1} of {steps.length}</Text>
          <View style={styles.progressTrack} lightColor="#E5E7EB" darkColor="#0F172A">
            <View
              style={[
                styles.progressFill,
                { width: `${progressPct}%`, backgroundColor: isDark ? '#34D399' : '#0F766E' },
              ]}
            />
          </View>
          <Text style={styles.reason}>
            Personalizes macros, goal pacing, and filters unsafe ingredients.
          </Text>
        </View>

        {currentStep === 'profile' ? (
          <Card title="Profile basics" reason="Used to set baseline energy needs.">
            <SectionLabel>Biological sex at birth</SectionLabel>
            <ChipRow>
              {[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
                { value: 'unspecified', label: 'Prefer not to say' },
              ].map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  selected={quiz.biologicalSex === item.value}
                  onPress={() =>
                    updateQuiz({ biologicalSex: item.value as QuizState['biologicalSex'] })
                  }
                />
              ))}
            </ChipRow>

            <SectionLabel>Age</SectionLabel>
            <TextInput
              placeholder="Age in years"
              keyboardType="number-pad"
              value={quiz.age ? String(quiz.age) : ''}
              onChangeText={(text) => {
                const num = parseInt(text, 10);
                updateQuiz({ age: Number.isFinite(num) ? num : null });
              }}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                  color: isDark ? '#F9FAFB' : '#111827',
                },
              ]}
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            />
            <Hint>Needed for metabolic estimates.</Hint>
          </Card>
        ) : null}

        {currentStep === 'body' ? (
          <Card title="Body metrics" reason="Used to size calorie + protein targets.">
            <SectionLabel>Height</SectionLabel>
            <ChipRow>
              {['cm', 'imperial'].map((unit) => (
                <Chip
                  key={unit}
                  label={unit === 'cm' ? 'cm' : 'ft + in'}
                  selected={quiz.heightUnit === unit}
                  onPress={() => handleHeightUnitChange(unit as 'cm' | 'imperial')}
                />
              ))}
            </ChipRow>
            {quiz.heightUnit === 'cm' ? (
              <TextInput
                placeholder="Height in cm"
                keyboardType="number-pad"
                value={quiz.heightCm ? String(quiz.heightCm) : ''}
                onChangeText={setHeightCm}
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                    color: isDark ? '#F9FAFB' : '#111827',
                  },
                ]}
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              />
            ) : (
              <View style={styles.rowGap}>
                <TextInput
                  placeholder="ft"
                  keyboardType="number-pad"
                  value={quiz.heightFeet != null ? String(quiz.heightFeet) : ''}
                  onChangeText={(text) => setHeightImperial(text, quiz.heightInches?.toString() ?? '')}
                  style={[
                    styles.input,
                    styles.halfInput,
                    {
                      backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                      color: isDark ? '#F9FAFB' : '#111827',
                    },
                  ]}
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                />
                <TextInput
                  placeholder="in"
                  keyboardType="number-pad"
                  value={quiz.heightInches != null ? String(quiz.heightInches) : ''}
                  onChangeText={(text) => setHeightImperial(quiz.heightFeet?.toString() ?? '', text)}
                  style={[
                    styles.input,
                    styles.halfInput,
                    {
                      backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                      color: isDark ? '#F9FAFB' : '#111827',
                    },
                  ]}
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                />
              </View>
            )}

            <SectionLabel>Weight</SectionLabel>
            <ChipRow>
              {['kg', 'lb'].map((unit) => (
                <Chip
                  key={unit}
                  label={unit}
                  selected={quiz.weightUnit === unit}
                  onPress={() => handleWeightUnitChange(unit as 'kg' | 'lb')}
                />
              ))}
            </ChipRow>
            <TextInput
              placeholder={`Current weight (${quiz.weightUnit})`}
              keyboardType="decimal-pad"
              value={
                quiz.weightKg
                  ? quiz.weightUnit === 'kg'
                    ? String(quiz.weightKg)
                    : kgToLb(quiz.weightKg).toFixed(1)
                  : ''
              }
              onChangeText={setWeightWithUnit}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                  color: isDark ? '#F9FAFB' : '#111827',
                },
              ]}
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            />
            <TextInput
              placeholder={`Goal weight (${quiz.weightUnit}, optional)`}
              keyboardType="decimal-pad"
              value={
                quiz.goalWeightKg
                  ? quiz.weightUnit === 'kg'
                    ? String(quiz.goalWeightKg)
                    : kgToLb(quiz.goalWeightKg).toFixed(1)
                  : ''
              }
              onChangeText={setGoalWeightWithUnit}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                  color: isDark ? '#F9FAFB' : '#111827',
                },
              ]}
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            />
          </Card>
        ) : null}

        {currentStep === 'goal' ? (
          <Card title="Goal & pace" reason="Shapes calorie delta and protein minimum.">
            <SectionLabel>Main goal</SectionLabel>
            <OptionGrid>
              {goalOptions.map((item) => (
                <OptionTile
                  key={item.value}
                  label={item.label}
                  note={item.note}
                  selected={quiz.goal === item.value}
                  onPress={() => updateQuiz({ goal: item.value as QuizState['goal'] })}
                />
              ))}
            </OptionGrid>

            <SectionLabel>Pace</SectionLabel>
            <View style={styles.paceRow}>
              {paceOptions.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => updateQuiz({ pace: item.value })}
                  style={[
                    styles.paceDot,
                    item.value === quiz.pace ? styles.paceDotActive : null,
                  ]}
                >
                  <Text style={styles.paceDotLabel}>{item.value}</Text>
                </Pressable>
              ))}
            </View>
            <Hint>{paceLabel}</Hint>

            <SectionLabel>Activity</SectionLabel>
            <OptionGrid>
              {activityOptions.map((item) => (
                <OptionTile
                  key={item.value}
                  label={item.label}
                  note={item.note}
                  selected={quiz.activityLevel === item.value}
                  onPress={() =>
                    updateQuiz({ activityLevel: item.value as QuizState['activityLevel'] })
                  }
                />
              ))}
            </OptionGrid>
          </Card>
        ) : null}

        {currentStep === 'diet' ? (
          <Card title="Diet & safety" reason="Filters allergens and styles before suggestions.">
            <SectionLabel>Diet style</SectionLabel>
            <ChipRow>
              {dietOptions.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  selected={quiz.dietStyle === item.value}
                  onPress={() =>
                    updateQuiz({ dietStyle: item.value as QuizState['dietStyle'] })
                  }
                />
              ))}
            </ChipRow>

            <SectionLabel>Allergens / avoid</SectionLabel>
            <ChipRow>
              {allergenOptions.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  selected={quiz.allergens.includes(item)}
                  onPress={() => toggleAllergen(item)}
                />
              ))}
            </ChipRow>
            <TextInput
              placeholder="Add other exclusions (e.g., cilantro, mushrooms)"
              value={quiz.avoidList}
              onChangeText={(text) => updateQuiz({ avoidList: text })}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                  color: isDark ? '#F9FAFB' : '#111827',
                },
              ]}
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              multiline
            />
            <Hint>We will never suggest ingredients you mark as allergens.</Hint>
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.footer} lightColor="#FFFFFF" darkColor="#0A0F1A">
          <Pressable onPress={handleSkip} style={styles.skipButton} disabled={submitting}>
            <Text style={styles.skipText}>Skip for now</Text>
            <Text style={styles.skipSubtext}>You can finish later; accuracy may drop.</Text>
          </Pressable>
        <View style={styles.navRow}>
          <Pressable
            onPress={goBack}
            style={[
              styles.secondaryButton,
              (stepIndex === 0 || submitting) && styles.secondaryDisabled,
            ]}
            disabled={stepIndex === 0 || submitting}
          >
            <Text style={styles.secondaryLabel}>Back</Text>
          </Pressable>
          <Pressable
            onPress={goNext}
            disabled={!isStepValid || submitting}
            style={[
              styles.primaryButton,
              { backgroundColor: isDark ? '#34D399' : '#0F766E' },
              (!isStepValid || submitting) && styles.primaryDisabled,
            ]}
          >
            <Text style={styles.primaryLabel}>
              {stepIndex === steps.length - 1 ? 'Finish setup' : 'Save & continue'}
            </Text>
          </Pressable>
        </View>
        {status === 'skipped' ? (
          <Text style={styles.skipWarning}>
            You skipped earlier—finish this to improve macro accuracy.
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Card({
  title,
  reason,
  children,
}: {
  title: string;
  reason: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card} lightColor="#FFFFFF" darkColor="#0B0F19">
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardReason}>{reason}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: '#0F766E', borderColor: '#0F766E' }
          : { backgroundColor: 'transparent', borderColor: '#CBD5E1' },
      ]}
    >
      <Text style={[styles.chipLabel, selected ? { color: '#F9FAFB' } : null]}>{label}</Text>
    </Pressable>
  );
}

function OptionGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.optionGrid}>{children}</View>;
}

function OptionTile({
  label,
  note,
  selected,
  onPress,
}: {
  label: string;
  note: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.optionTile,
        selected
          ? { borderColor: '#0F766E', backgroundColor: '#ECFEFF' }
          : { borderColor: '#E5E7EB' },
      ]}
    >
      <Text style={styles.optionLabel}>{label}</Text>
      <Text style={styles.optionNote}>{note}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 140,
    gap: 16,
  },
  topBar: {
    gap: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  reason: {
    fontSize: 14,
    opacity: 0.75,
    lineHeight: 20,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardReason: {
    fontSize: 14,
    opacity: 0.75,
  },
  cardBody: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  rowGap: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionTile: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionNote: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  paceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paceDot: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  paceDotActive: {
    backgroundColor: '#ECFEFF',
    borderColor: '#0F766E',
  },
  paceDotLabel: {
    fontWeight: '700',
    color: '#0F172A',
  },
  hint: {
    fontSize: 13,
    color: '#0F766E',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  secondaryDisabled: {
    opacity: 0.4,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  skipButton: {
    alignItems: 'center',
    gap: 4,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  skipSubtext: {
    fontSize: 13,
    opacity: 0.7,
  },
  skipWarning: {
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
  },
});
