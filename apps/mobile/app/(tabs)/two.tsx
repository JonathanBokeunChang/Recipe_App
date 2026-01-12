import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function TabTwoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Library</Text>
      <Text style={styles.subtitle}>
        Saved recipes and variations will appear here.
      </Text>
      <View style={styles.emptyCard} lightColor="#FFFFFF" darkColor="#0B0F19">
        <Text style={styles.emptyTitle}>No recipes yet</Text>
        <Text style={styles.emptyBody}>
          Create your first recipe from a video, then save it to build your library.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
  },
});
