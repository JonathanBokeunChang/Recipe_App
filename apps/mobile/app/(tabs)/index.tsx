import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/components/auth';

export default function TabOneScreen() {
  const { user, signOut } = useAuth();

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

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Paste Video Link</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton}>
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
  actions: {
    gap: 12,
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
