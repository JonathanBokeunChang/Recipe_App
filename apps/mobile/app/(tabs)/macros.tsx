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

const COLORS = {
  calories: '#3B82F6',
  protein: '#22C55E',
  carbs: '#F97316',
  fat: '#EAB308',
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

        <View style={styles.incompleteCard} lightColor="#FFFFFF" darkColor="#0B0F19">
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
          backgroundColor="#E5E7EB"
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
            backgroundColor="#E5E7EB"
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
            backgroundColor="#E5E7EB"
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
            backgroundColor="#E5E7EB"
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
        <View style={styles.entriesCard} lightColor="#FFFFFF" darkColor="#0B0F19">
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
      <View style={styles.detailsCard} lightColor="#FFFFFF" darkColor="#0B0F19">
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
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  goalPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  goalPillText: {
    color: '#F9FAFB',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  incompleteCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  incompleteTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  incompleteBody: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  missingList: {
    marginTop: 4,
    gap: 4,
  },
  missingLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
  },
  missingItem: {
    fontSize: 14,
    opacity: 0.8,
    marginLeft: 4,
  },
  ctaButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  calorieRingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  calorieConsumed: {
    fontSize: 36,
    fontWeight: '700',
  },
  calorieTarget: {
    fontSize: 14,
    opacity: 0.6,
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
    fontWeight: '700',
  },
  macroRingTarget: {
    fontSize: 12,
    opacity: 0.6,
  },
  macroRingLabel: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.8,
  },
  addFoodButton: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addFoodButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  entriesCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  entriesTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
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
    fontWeight: '500',
  },
  entryMacros: {
    fontSize: 12,
    opacity: 0.6,
  },
  deleteButton: {
    padding: 8,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  detailsTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  updateLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  updateLinkText: {
    fontSize: 15,
    color: '#3B82F6',
    fontWeight: '500',
  },
});
