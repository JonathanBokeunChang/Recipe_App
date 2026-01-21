import React from 'react';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import type { ConditionWarning } from '@/lib/dietary-guardrails';

export function ConditionWarnings({
  warnings,
  title = 'Dietary alerts',
}: {
  warnings: ConditionWarning[];
  title?: string;
}) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <View style={styles.card} lightColor="#FEF2F2" darkColor="#111827">
      <Text style={styles.title}>{title}</Text>
      {warnings.map((warning, idx) => (
        <View key={`${warning.condition}-${idx}`} style={styles.warningBlock}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{warning.label}</Text>
          </View>
          <Text style={styles.message}>{warning.message}</Text>
          {warning.hits?.length ? (
            <Text style={styles.hits}>Flags: {warning.hits.join(', ')}</Text>
          ) : null}
          {warning.suggestion ? (
            <Text style={styles.suggestion}>{warning.suggestion}</Text>
          ) : null}
        </View>
      ))}
      <Text style={styles.disclaimer}>
        Not medical advice. Confirm with your clinician for strict therapeutic diets.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B91C1C',
  },
  warningBlock: {
    gap: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  hits: {
    fontSize: 12,
    color: '#B91C1C',
  },
  suggestion: {
    fontSize: 12,
    opacity: 0.8,
  },
  disclaimer: {
    fontSize: 11,
    opacity: 0.7,
  },
});
