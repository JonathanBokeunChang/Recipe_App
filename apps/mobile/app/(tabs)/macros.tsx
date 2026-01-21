import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useQuiz } from '@/components/quiz-state';
import { useMacroTracking } from '@/components/macro-tracking-state';
import { CircularProgress } from '@/components/CircularProgress';
import { AddMacroModal } from '@/components/AddMacroModal';
import {
  calculateMacros,
  formatGoalName,
  type CalculationResult,
} from '@/lib/macro-calculator';
import { PALETTE } from '@/constants/palette';

const COLORS = {
  calories: PALETTE.accentCyan,
  protein: PALETTE.accent,
  carbs: PALETTE.accentSecondary,
  fat: PALETTE.accentPink,
};

export default function MacrosScreen() {
  const router = useRouter();
  const { quiz, status } = useQuiz();
  const { today, removeEntry } = useMacroTracking();
  const [modalVisible, setModalVisible] = useState(false);

  const result: CalculationResult = useMemo(
    () => calculateMacros(quiz),
    [quiz]
  );

  if (!result.isComplete) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your Macros</Text>
        <Text style={styles.subtitle}>
          Daily macro targets based on your profile and goals.
        </Text>

        <View
          style={styles.incompleteCard}
          lightColor={PALETTE.surface}
          darkColor={PALETTE.surface}
        >
          <Text style={styles.incompleteTitle}>Complete Your Profile</Text>
          <Text style={styles.incompleteBody}>
            We need a bit more info to calculate your personalized macro targets.
          </Text>

          {result.missingFields.length > 0 && (
            <View style={styles.missingList}>
              <Text style={styles.missingLabel}>Missing:</Text>
              {result.missingFields.map((field) => (
                <Text key={field} style={styles.missingItem}>
                  • {field}
                </Text>
              ))}
            </View>
          )}

          <Pressable
            style={styles.ctaButton}
            onPress={() => router.push('/quiz')}
          >
            <Text style={styles.ctaButtonText}>
              {status === 'skipped' ? 'Complete Quiz' : 'Take Quiz'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const { macros, bmr, tdee, goalAdjustment } = result;
  const targets = macros!;
  const consumed = today.totals;

  const calorieProgress = Math.min(consumed.calories / targets.calories, 1);
  const proteinProgress = Math.min(consumed.protein / targets.protein, 1);
  const carbsProgress = Math.min(consumed.carbs / targets.carbs, 1);
  const fatProgress = Math.min(consumed.fat / targets.fat, 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your Macros</Text>
      <View style={styles.goalPill}>
        <Text style={styles.goalPillText}>
          {formatGoalName(quiz.goal)} Target
        </Text>
      </View>

      {/* Main Calorie Ring */}
      <View style={styles.calorieRingContainer}>
        <CircularProgress
          progress={calorieProgress}
          size={200}
          strokeWidth={16}
          color={COLORS.calories}
          backgroundColor={PALETTE.mutedBorder}
        >
          <Text style={styles.calorieConsumed}>{Math.round(consumed.calories)}</Text>
          <Text style={styles.calorieTarget}>/ {targets.calories} cal</Text>
        </CircularProgress>
      </View>

      {/* Macro Rings Row */}
      <View style={styles.macroRingsRow}>
        <View style={styles.macroRingItem}>
          <CircularProgress
            progress={proteinProgress}
            size={90}
            strokeWidth={8}
            color={COLORS.protein}
            backgroundColor={PALETTE.mutedBorder}
          >
            <Text style={styles.macroRingValue}>{Math.round(consumed.protein)}</Text>
          </CircularProgress>
          <Text style={styles.macroRingTarget}>/ {targets.protein}g</Text>
          <Text style={styles.macroRingLabel}>Protein</Text>
        </View>

        <View style={styles.macroRingItem}>
          <CircularProgress
            progress={carbsProgress}
            size={90}
            strokeWidth={8}
            color={COLORS.carbs}
            backgroundColor={PALETTE.mutedBorder}
          >
            <Text style={styles.macroRingValue}>{Math.round(consumed.carbs)}</Text>
          </CircularProgress>
          <Text style={styles.macroRingTarget}>/ {targets.carbs}g</Text>
          <Text style={styles.macroRingLabel}>Carbs</Text>
        </View>

        <View style={styles.macroRingItem}>
          <CircularProgress
            progress={fatProgress}
            size={90}
            strokeWidth={8}
            color={COLORS.fat}
            backgroundColor={PALETTE.mutedBorder}
          >
            <Text style={styles.macroRingValue}>{Math.round(consumed.fat)}</Text>
          </CircularProgress>
          <Text style={styles.macroRingTarget}>/ {targets.fat}g</Text>
          <Text style={styles.macroRingLabel}>Fat</Text>
        </View>
      </View>

      {/* Add Food Button */}
      <Pressable
        style={styles.addFoodButton}
        onPress={() => setModalVisible(true)}
      >
        <FontAwesome name="plus" size={16} color="#FFFFFF" />
        <Text style={styles.addFoodButtonText}>Add Food</Text>
      </Pressable>

      {/* Today's Entries */}
      {today.entries.length > 0 && (
        <View
          style={styles.entriesCard}
          lightColor={PALETTE.surface}
          darkColor={PALETTE.surface}
        >
          <Text style={styles.entriesTitle}>Today's Entries</Text>
          {today.entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.entryInfo}>
                <Text style={styles.entryLabel}>{entry.label}</Text>
                <Text style={styles.entryMacros}>
                  {entry.calories} cal · P{entry.protein} · C{entry.carbs} · F{entry.fat}
                </Text>
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => removeEntry(entry.id)}
              >
                <FontAwesome name="trash-o" size={16} color="#EF4444" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Calculation Details */}
      <View
        style={styles.detailsCard}
        lightColor={PALETTE.surface}
        darkColor={PALETTE.surface}
      >
        <Text style={styles.detailsTitle}>How we calculated this</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Basal Metabolic Rate (BMR)</Text>
          <Text style={styles.detailValue}>{bmr} cal</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Activity Level</Text>
          <Text style={styles.detailValue}>{quiz.activityLevel?.replace('_', ' ')}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Maintenance (TDEE)</Text>
          <Text style={styles.detailValue}>{tdee} cal</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Goal Adjustment</Text>
          <Text style={styles.detailValue}>
            {goalAdjustment >= 0 ? '+' : ''}{goalAdjustment} cal
          </Text>
        </View>
      </View>

      <Pressable
        style={styles.updateLink}
        onPress={() => router.push('/quiz')}
      >
        <Text style={styles.updateLinkText}>Update your stats</Text>
      </Pressable>

      <AddMacroModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 16,
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
  goalPill: {
    backgroundColor: PALETTE.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  goalPillText: {
    color: PALETTE.accent,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  incompleteCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
    gap: 12,
  },
  incompleteTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: PALETTE.text,
  },
  incompleteBody: {
    fontSize: 14,
    lineHeight: 20,
    color: PALETTE.mutedText,
  },
  missingList: {
    marginTop: 4,
    gap: 4,
  },
  missingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.mutedText,
  },
  missingItem: {
    fontSize: 14,
    color: PALETTE.text,
    marginLeft: 4,
  },
  ctaButton: {
    backgroundColor: PALETTE.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaButtonText: {
    color: '#031305',
    fontSize: 16,
    fontWeight: '800',
  },
  calorieRingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  calorieConsumed: {
    fontSize: 36,
    fontWeight: '800',
    color: PALETTE.text,
  },
  calorieTarget: {
    fontSize: 14,
    color: PALETTE.mutedText,
  },
  macroRingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  macroRingItem: {
    alignItems: 'center',
    gap: 4,
  },
  macroRingValue: {
    fontSize: 18,
    fontWeight: '800',
    color: PALETTE.text,
  },
  macroRingTarget: {
    fontSize: 12,
    color: PALETTE.mutedText,
  },
  macroRingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.mutedText,
  },
  addFoodButton: {
    backgroundColor: PALETTE.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  addFoodButtonText: {
    color: PALETTE.text,
    fontSize: 16,
    fontWeight: '700',
  },
  entriesCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
    gap: 12,
  },
  entriesTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    color: PALETTE.text,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryInfo: {
    flex: 1,
    gap: 2,
  },
  entryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.text,
  },
  entryMacros: {
    fontSize: 12,
    color: PALETTE.mutedText,
  },
  deleteButton: {
    padding: 8,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
    gap: 12,
  },
  detailsTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    color: PALETTE.text,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: PALETTE.mutedText,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.text,
  },
  updateLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  updateLinkText: {
    fontSize: 15,
    color: PALETTE.accentCyan,
    fontWeight: '700',
  },
});
