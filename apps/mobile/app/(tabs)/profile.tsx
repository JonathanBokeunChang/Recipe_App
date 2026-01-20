import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/components/auth';
import { useQuiz } from '@/components/quiz-state';

// Helper functions for display formatting
function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatHeight(
  cm: number | null,
  unit: 'cm' | 'imperial',
  feet?: number | null,
  inches?: number | null
): string {
  if (!cm) return 'Not set';
  if (unit === 'imperial' && feet != null) {
    return `${feet}'${inches ?? 0}"`;
  }
  return `${cm} cm`;
}

function formatWeight(kg: number | null, unit: 'kg' | 'lb'): string {
  if (!kg) return 'Not set';
  if (unit === 'lb') {
    return `${Math.round(kg * 2.20462)} lb`;
  }
  return `${kg} kg`;
}

function formatGoal(goal: string | null): string {
  const labels: Record<string, string> = {
    bulk: 'Bulk',
    lean_bulk: 'Lean Bulk',
    cut: 'Cut',
    maintain: 'Maintain',
  };
  return goal ? labels[goal] ?? goal : 'Not set';
}

function formatActivityLevel(level: string | null): string {
  const labels: Record<string, string> = {
    sedentary: 'Sedentary',
    light: 'Lightly Active',
    moderate: 'Moderately Active',
    active: 'Active',
    very_active: 'Very Active',
  };
  return level ? labels[level] ?? level : 'Not set';
}

function formatDietStyle(style: string): string {
  const labels: Record<string, string> = {
    none: 'No restrictions',
    vegetarian: 'Vegetarian',
    vegan: 'Vegan',
    pescatarian: 'Pescatarian',
  };
  return labels[style] ?? style;
}

function formatPace(pace: number): string {
  const labels: Record<number, string> = {
    1: 'Gentle',
    2: 'Steady',
    3: 'Balanced',
    4: 'Fast',
    5: 'Aggressive',
  };
  return labels[pace] ?? 'Balanced';
}

function formatSex(sex: string | null): string {
  if (!sex) return 'Not set';
  return sex.charAt(0).toUpperCase() + sex.slice(1);
}

// Reusable InfoRow component
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, loading } = useAuth();
  const { quiz, status: quizStatus } = useQuiz();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handleEditProfile = () => {
    router.push('/quiz');
  };

  const isQuizComplete = quizStatus === 'completed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>
        Your account details and personalization settings.
      </Text>

      {/* Account Info Card */}
      <View style={styles.card} lightColor="#FFFFFF" darkColor="#0B0F19">
        <View style={styles.cardHeader}>
          <FontAwesome name="user-circle" size={20} color="#6B7280" />
          <Text style={styles.cardTitle}>Account</Text>
        </View>
        <View style={styles.divider} lightColor="#E5E7EB" darkColor="#1F2937" />

        <InfoRow label="Email" value={user?.email ?? 'Not set'} />
        <InfoRow label="Account type" value={user?.kind === 'member' ? 'Member' : 'Guest'} />
        <InfoRow label="Member since" value={formatDate(user?.profile?.created_at)} />
      </View>

      {/* Body Stats Card */}
      <View style={styles.card} lightColor="#FFFFFF" darkColor="#0B0F19">
        <View style={styles.cardHeader}>
          <FontAwesome name="heartbeat" size={20} color="#6B7280" />
          <Text style={styles.cardTitle}>Body Stats</Text>
        </View>
        <View style={styles.divider} lightColor="#E5E7EB" darkColor="#1F2937" />

        {isQuizComplete ? (
          <>
            <InfoRow label="Biological sex" value={formatSex(quiz.biologicalSex)} />
            <InfoRow label="Age" value={quiz.age ? `${quiz.age} years` : 'Not set'} />
            <InfoRow
              label="Height"
              value={formatHeight(quiz.heightCm, quiz.heightUnit, quiz.heightFeet, quiz.heightInches)}
            />
            <InfoRow
              label="Current weight"
              value={formatWeight(quiz.weightKg, quiz.weightUnit)}
            />
            {quiz.goalWeightKg && (
              <InfoRow
                label="Goal weight"
                value={formatWeight(quiz.goalWeightKg, quiz.weightUnit)}
              />
            )}
          </>
        ) : (
          <View style={styles.incompleteNotice}>
            <Text style={styles.incompleteText}>
              Complete the quiz to see your body stats
            </Text>
          </View>
        )}
      </View>

      {/* Goals & Activity Card */}
      <View style={styles.card} lightColor="#FFFFFF" darkColor="#0B0F19">
        <View style={styles.cardHeader}>
          <FontAwesome name="bullseye" size={20} color="#6B7280" />
          <Text style={styles.cardTitle}>Goals & Activity</Text>
        </View>
        <View style={styles.divider} lightColor="#E5E7EB" darkColor="#1F2937" />

        {isQuizComplete ? (
          <>
            <InfoRow label="Current goal" value={formatGoal(quiz.goal)} />
            <InfoRow label="Pace" value={formatPace(quiz.pace)} />
            <InfoRow label="Activity level" value={formatActivityLevel(quiz.activityLevel)} />
          </>
        ) : (
          <View style={styles.incompleteNotice}>
            <Text style={styles.incompleteText}>
              Complete the quiz to set your goals
            </Text>
          </View>
        )}
      </View>

      {/* Diet & Safety Card */}
      <View style={styles.card} lightColor="#FFFFFF" darkColor="#0B0F19">
        <View style={styles.cardHeader}>
          <FontAwesome name="leaf" size={20} color="#6B7280" />
          <Text style={styles.cardTitle}>Diet & Safety</Text>
        </View>
        <View style={styles.divider} lightColor="#E5E7EB" darkColor="#1F2937" />

        <InfoRow label="Diet style" value={formatDietStyle(quiz.dietStyle)} />

        {quiz.allergens.length > 0 ? (
          <View style={styles.allergenRow}>
            <Text style={styles.infoLabel}>Allergens</Text>
            <View style={styles.chipContainer}>
              {quiz.allergens.map((allergen) => (
                <View key={allergen} style={styles.allergenChip}>
                  <Text style={styles.allergenChipText}>{allergen}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <InfoRow label="Allergens" value="None" />
        )}

        {quiz.avoidList ? (
          <InfoRow label="Also avoiding" value={quiz.avoidList} />
        ) : null}
      </View>

      {/* Action Buttons */}
      <Pressable style={styles.primaryButton} onPress={handleEditProfile}>
        <Text style={styles.primaryButtonText}>
          {isQuizComplete ? 'Edit Profile' : 'Complete Profile'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.signOutButton}
        onPress={handleSignOut}
        disabled={loading}
      >
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </Pressable>
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
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  allergenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  allergenChip: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  allergenChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
  },
  incompleteNotice: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  incompleteText: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  primaryButton: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    borderColor: '#DC2626',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
});
