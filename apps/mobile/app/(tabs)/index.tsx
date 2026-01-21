import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

import { Text } from '@/components/Themed';
import { useAuth } from '@/components/auth';
import { useQuiz } from '@/components/quiz-state';
import { useMacroTracking } from '@/components/macro-tracking-state';
import { CircularProgress } from '@/components/CircularProgress';
import {
  calculateMacros,
  formatGoalName,
  type CalculationResult,
} from '@/lib/macro-calculator';
import { PALETTE } from '@/constants/palette';

type MetricRowProps = {
  label: string;
  value: number;
  target: number;
  color: string;
};

export default function TabOneScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { quiz, status: quizStatus } = useQuiz();
  const { today } = useMacroTracking();

  const result: CalculationResult = useMemo(
    () => calculateMacros(quiz),
    [quiz]
  );

  const targets = result.macros;
  const calorieTarget = targets?.calories ?? 0;
  const consumed = today.totals;

  const calorieProgress = calorieTarget
    ? Math.min(consumed.calories / calorieTarget, 1)
    : 0;

  const macroData: MetricRowProps[] = [
    { label: 'Protein', value: consumed.protein, target: targets?.protein ?? 0, color: PALETTE.accent },
    { label: 'Carbs', value: consumed.carbs, target: targets?.carbs ?? 0, color: PALETTE.accentSecondary },
    { label: 'Fat', value: consumed.fat, target: targets?.fat ?? 0, color: PALETTE.accentPink },
  ];

  const recentEntries = today.entries.slice(-4).reverse();
  const goalLabel = formatGoalName(quiz.goal) || 'Set goal';
  const quizIncomplete = !result.isComplete;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>NourishLy · Macro HUD</Text>
          <Text style={styles.title}>
            Hi {user?.email ? user.email.split('@')[0] : 'there'}
          </Text>
          <Text style={styles.subtitle}>
            Video → recipe → macros in under 60 seconds.
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={() => router.push('/modal')}>
            <FontAwesome name="info-circle" size={18} color={PALETTE.accent} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={signOut}>
            <FontAwesome name="power-off" size={18} color={PALETTE.accentSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroLabel}>Goal · {goalLabel}</Text>
          <Text style={styles.heroTitle}>Macro HUD</Text>
          <Text style={styles.heroBody}>
            {quizIncomplete
              ? 'Finish your quiz to personalize targets and keep allergens out.'
              : 'Targets auto-adjust when you log meals or lock a goal.'}
          </Text>
          <View style={styles.heroChips}>
            <Chip label={quiz.dietStyle ? quiz.dietStyle.toUpperCase() : 'NO_DIET_FILTER'} />
            <Chip label={`${quiz.allergens.length} allergen${quiz.allergens.length === 1 ? '' : 's'}`} />
            <Chip label={quizStatus === 'skipped' ? 'QUIZ_SKIPPED' : 'SYNCED'} tone={quizStatus === 'skipped' ? 'warning' : 'accent'} />
          </View>
        </View>
        <View style={styles.ringWrap}>
          <CircularProgress
            progress={calorieProgress}
            size={156}
            strokeWidth={14}
            color={PALETTE.accent}
            backgroundColor={PALETTE.mutedBorder}
          >
            <Text style={styles.caloriesValue}>{Math.round(consumed.calories)}</Text>
            <Text style={styles.caloriesTarget}>/ {calorieTarget || '—'} kcal</Text>
          </CircularProgress>
          <Text style={styles.ringLabel}>Live today</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Live macros</Text>
          <Pressable onPress={() => router.push('/(tabs)/macros')}>
            <Text style={styles.link}>Open tracker</Text>
          </Pressable>
        </View>

        {quizIncomplete ? (
          <Pressable
            style={[styles.inlineCta, styles.border]}
            onPress={() => router.push('/quiz')}
          >
            <FontAwesome name="exclamation-triangle" color={PALETTE.warning} size={16} />
            <Text style={styles.inlineCtaText}>
              Quiz incomplete — personalize targets
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.metricGrid}>
          {macroData.map((metric) => (
            <MetricRow key={metric.label} {...metric} />
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <Text style={styles.sectionSub}>Fast paths stay under 60s</Text>
        </View>
        <View style={styles.actionGrid}>
          <ActionTile
            label="Upload video"
            icon="cloud-upload"
            onPress={() => router.push('/upload-video' as any)}
          />
          <ActionTile
            label="Scan recipe"
            icon="camera"
            onPress={() => router.push('/upload-recipe-image')}
          />
          <ActionTile
            label="Paste link"
            icon="link"
            onPress={() => router.push('/paste-link')}
          />
          <ActionTile
            label="Open library"
            icon="book"
            onPress={() => router.push('/(tabs)/two')}
          />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Safety + filters</Text>
          <Pressable onPress={() => router.push('/quiz')}>
            <Text style={styles.link}>Edit profile</Text>
          </Pressable>
        </View>
        <View style={styles.safetyRow}>
          <Text style={styles.safetyLabel}>Diet style</Text>
          <Text style={styles.safetyValue}>
            {quiz.dietStyle ? quiz.dietStyle.replace('_', ' ') : 'None'}
          </Text>
        </View>
        <View style={styles.safetyRow}>
          <Text style={styles.safetyLabel}>Allergens</Text>
          <Text style={styles.safetyValue}>
            {quiz.allergens.length ? quiz.allergens.join(', ') : 'None'}
          </Text>
        </View>
        {quiz.avoidList ? (
          <View style={styles.safetyRow}>
            <Text style={styles.safetyLabel}>Avoid list</Text>
            <Text style={styles.safetyValue}>{quiz.avoidList}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today&apos;s log</Text>
          <Pressable onPress={() => router.push('/(tabs)/macros')}>
            <Text style={styles.link}>Add meal</Text>
          </Pressable>
        </View>
        {recentEntries.length === 0 ? (
          <Text style={styles.emptyState}>No entries yet. Log your first meal.</Text>
        ) : (
          recentEntries.map((entry) => (
            <View key={entry.id} style={[styles.entryRow, styles.border]}>
              <View style={styles.entryLeft}>
                <Text style={styles.entryLabel}>{entry.label}</Text>
                <Text style={styles.entryMeta}>
                  {entry.calories} cal · P{entry.protein} · C{entry.carbs} · F{entry.fat}
                </Text>
              </View>
              <Text style={styles.entryTime}>
                {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function MetricRow({ label, value, target, color }: MetricRowProps) {
  const safeTarget = target || 1;
  const pct = Math.min(value / safeTarget, 1);

  return (
    <View style={styles.metricRow}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>{Math.round(value)} / {Math.round(target || 0)}</Text>
      </View>
      <View style={styles.metricTrack}>
        <View style={[styles.metricFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ActionTile({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.actionTile, styles.border]} onPress={onPress}>
      <View style={styles.actionIcon}>
        <FontAwesome name={icon} size={18} color={PALETTE.accent} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function Chip({
  label,
  tone = 'muted',
}: {
  label: string;
  tone?: 'accent' | 'warning' | 'muted';
}) {
  const color =
    tone === 'accent'
      ? PALETTE.accent
      : tone === 'warning'
        ? PALETTE.warning
        : PALETTE.mutedText;
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 40,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  eyebrow: {
    color: PALETTE.mutedText,
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: PALETTE.text,
  },
  subtitle: {
    fontSize: 14,
    color: PALETTE.mutedText,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.surfaceAlt,
  },
  heroCard: {
    flexDirection: 'row',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: PALETTE.surface,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroLabel: {
    fontSize: 12,
    color: PALETTE.mutedText,
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: PALETTE.text,
  },
  heroBody: {
    fontSize: 14,
    color: PALETTE.mutedText,
    lineHeight: 20,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  caloriesValue: {
    fontSize: 28,
    fontWeight: '800',
    color: PALETTE.text,
  },
  caloriesTarget: {
    fontSize: 12,
    color: PALETTE.mutedText,
  },
  ringLabel: {
    color: PALETTE.mutedText,
    fontSize: 12,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: PALETTE.surface,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: PALETTE.text,
  },
  sectionSub: {
    color: PALETTE.mutedText,
    fontSize: 12,
  },
  link: {
    color: PALETTE.accent,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  inlineCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: PALETTE.surfaceAlt,
  },
  inlineCtaText: {
    color: PALETTE.text,
    fontWeight: '700',
  },
  metricGrid: {
    gap: 12,
  },
  metricRow: {
    gap: 8,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    color: PALETTE.mutedText,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  metricTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: PALETTE.mutedBorder,
    overflow: 'hidden',
  },
  metricFill: {
    height: '100%',
    borderRadius: 999,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionTile: {
    width: '48%',
    padding: 14,
    borderRadius: 14,
    backgroundColor: PALETTE.surfaceAlt,
    gap: 10,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.background,
  },
  actionLabel: {
    color: PALETTE.text,
    fontWeight: '700',
    fontSize: 14,
  },
  safetyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  safetyLabel: {
    color: PALETTE.mutedText,
    fontSize: 13,
    flex: 1,
  },
  safetyValue: {
    color: PALETTE.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  emptyState: {
    color: PALETTE.mutedText,
    fontSize: 13,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  entryLeft: {
    flex: 1,
    gap: 4,
  },
  entryLabel: {
    color: PALETTE.text,
    fontWeight: '700',
    fontSize: 14,
  },
  entryMeta: {
    color: PALETTE.mutedText,
    fontSize: 12,
  },
  entryTime: {
    color: PALETTE.mutedText,
    fontSize: 12,
    marginLeft: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: PALETTE.surfaceAlt,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  border: {
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
});
