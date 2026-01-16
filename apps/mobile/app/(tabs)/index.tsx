import { Alert, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useAuth, GoalType } from '@/components/auth';
import { useQuiz } from '@/components/quiz-state';

export default function TabOneScreen() {
  const { user, signOut, setGoal } = useAuth();
  const router = useRouter();
  const { status: quizStatus } = useQuiz();
  const showQuizReminder = quizStatus === 'skipped';

  const goals: { value: GoalType; label: string; description: string }[] = [
    { value: 'bulk', label: 'Bulk', description: 'Maximize muscle gain with calorie surplus' },
    { value: 'lean_bulk', label: 'Lean Bulk', description: 'Build muscle with minimal fat gain' },
    { value: 'cut', label: 'Cut', description: 'Lose fat while preserving muscle' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.subtitle}>
          Signed in as {user?.kind === 'guest' ? 'Guest' : 'Member'}
        </Text>
        <Text style={styles.body}>
          Start by pasting a video link or uploading a file to generate a recipe with macros.
        </Text>
      </View>

      {showQuizReminder ? (
        <View style={styles.banner} lightColor="#ECFEFF" darkColor="#0B1224">
          <Text style={styles.bannerTitle}>Finish your quick setup</Text>
          <Text style={styles.bannerBody}>
            You skipped the intake quiz. Complete it to tighten macro targets and avoid allergens.
          </Text>
          <Pressable style={styles.bannerButton} onPress={() => router.push('/quiz')}>
            <Text style={styles.bannerButtonText}>Resume quiz</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.goalSelection}>
        <Text style={styles.goalTitle}>Your Goal</Text>
        <View style={styles.goalButtons}>
          {goals.map((goal) => (
            <Pressable
              key={goal.value}
              style={[
                styles.goalButton,
                user?.goal === goal.value && styles.goalButtonActive,
              ]}
              onPress={() => setGoal(goal.value)}
            >
              <Text
                style={[
                  styles.goalButtonText,
                  user?.goal === goal.value && styles.goalButtonTextActive,
                ]}
              >
                {goal.label}
              </Text>
              <Text
                style={[
                  styles.goalButtonDesc,
                  user?.goal === goal.value && styles.goalButtonDescActive,
                ]}
              >
                {goal.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/paste-link')}>
          <Text style={styles.primaryButtonText}>Paste Video Link</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            Alert.alert('Upload coming soon', 'We will add video uploads next.')
          }
        >
          <Text style={styles.secondaryButtonText}>Upload Video</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={signOut}>
          <Text style={styles.linkButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  hero: {
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.85,
  },
  goalSelection: {
    gap: 12,
    marginTop: 12,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  goalButtons: {
    gap: 8,
  },
  goalButton: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  goalButtonActive: {
    borderColor: '#111827',
    backgroundColor: '#F9FAFB',
  },
  goalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.7,
  },
  goalButtonTextActive: {
    opacity: 1,
    fontWeight: '700',
  },
  goalButtonDesc: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.6,
  },
  goalButtonDescActive: {
    opacity: 0.8,
  },
  actions: {
    gap: 12,
  },
  banner: {
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#0F766E',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  bannerBody: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  bannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  bannerButtonText: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderColor: '#111827',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
