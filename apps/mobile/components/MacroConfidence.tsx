/**
 * MacroConfidence Component
 *
 * Displays confidence level and details for macro calculations.
 * Shows which ingredients need review and why.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';

// Types
interface ConfidenceFactor {
  ingredient: string;
  confidence: 'high' | 'medium' | 'low' | 'failed';
  reason: string;
}

interface IngredientBreakdown {
  high: number;
  medium: number;
  low: number;
  failed: number;
}

interface MacroConfidenceData {
  overall: 'high' | 'medium' | 'low';
  score: number;
  factors: ConfidenceFactor[];
  ingredientBreakdown: IngredientBreakdown;
}

interface IngredientDetail {
  original: string;
  name: string;
  grams: number | null;
  confidence: 'high' | 'medium' | 'low' | 'failed';
  fdcMatch?: {
    description: string;
    dataType: string;
    matchScore: number;
  };
  macros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  assumptions?: string[];
  warnings?: string[];
}

interface MacroConfidenceProps {
  confidence: MacroConfidenceData;
  ingredients?: IngredientDetail[];
  compact?: boolean;
}

// Confidence colors
const CONFIDENCE_COLORS = {
  high: '#22c55e', // green
  medium: '#f59e0b', // amber
  low: '#ef4444', // red
  failed: '#6b7280', // gray
};

const CONFIDENCE_BG_COLORS = {
  high: '#dcfce7',
  medium: '#fef3c7',
  low: '#fee2e2',
  failed: '#f3f4f6',
};

const CONFIDENCE_LABELS = {
  high: 'High Confidence',
  medium: 'Medium Confidence',
  low: 'Low Confidence',
  failed: 'Unable to Calculate',
};

const CONFIDENCE_ICONS = {
  high: '\u2713', // checkmark
  medium: '\u26A0', // warning
  low: '\u2757', // exclamation
  failed: '\u2717', // x mark
};

/**
 * Compact confidence badge for inline display
 */
export function ConfidenceBadge({
  confidence,
  onPress,
}: {
  confidence: 'high' | 'medium' | 'low' | 'failed';
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[
        styles.badge,
        { backgroundColor: CONFIDENCE_BG_COLORS[confidence] },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.badgeIcon, { color: CONFIDENCE_COLORS[confidence] }]}>
        {CONFIDENCE_ICONS[confidence]}
      </Text>
      <Text style={[styles.badgeText, { color: CONFIDENCE_COLORS[confidence] }]}>
        {confidence === 'high' ? 'Accurate' : confidence === 'medium' ? 'Estimated' : confidence === 'low' ? 'Uncertain' : 'N/A'}
      </Text>
    </Wrapper>
  );
}

/**
 * Full confidence display with expandable details
 */
export function MacroConfidence({
  confidence,
  ingredients = [],
  compact = false,
}: MacroConfidenceProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (compact) {
    return (
      <ConfidenceBadge
        confidence={confidence.overall}
        onPress={() => setShowDetails(true)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Main confidence indicator */}
      <TouchableOpacity
        style={[
          styles.mainIndicator,
          { backgroundColor: CONFIDENCE_BG_COLORS[confidence.overall] },
        ]}
        onPress={() => setShowDetails(true)}
        activeOpacity={0.8}
      >
        <View style={styles.mainIndicatorLeft}>
          <Text
            style={[
              styles.mainIcon,
              { color: CONFIDENCE_COLORS[confidence.overall] },
            ]}
          >
            {CONFIDENCE_ICONS[confidence.overall]}
          </Text>
          <View>
            <Text
              style={[
                styles.mainLabel,
                { color: CONFIDENCE_COLORS[confidence.overall] },
              ]}
            >
              {CONFIDENCE_LABELS[confidence.overall]}
            </Text>
            <Text style={styles.mainSubtext}>
              {confidence.score}% accuracy score
            </Text>
          </View>
        </View>
        <Text style={styles.expandIcon}>{'\u276F'}</Text>
      </TouchableOpacity>

      {/* Quick breakdown */}
      {confidence.ingredientBreakdown && (
        <View style={styles.breakdown}>
          <BreakdownItem
            label="Accurate"
            count={confidence.ingredientBreakdown.high}
            color={CONFIDENCE_COLORS.high}
          />
          <BreakdownItem
            label="Estimated"
            count={confidence.ingredientBreakdown.medium}
            color={CONFIDENCE_COLORS.medium}
          />
          <BreakdownItem
            label="Uncertain"
            count={confidence.ingredientBreakdown.low + confidence.ingredientBreakdown.failed}
            color={CONFIDENCE_COLORS.low}
          />
        </View>
      )}

      {/* Issues summary */}
      {confidence.factors.length > 0 && (
        <View style={styles.issuesSummary}>
          <Text style={styles.issuesTitle}>
            {confidence.factors.length} ingredient{confidence.factors.length !== 1 ? 's' : ''} need review
          </Text>
        </View>
      )}

      {/* Details modal */}
      <ConfidenceDetailsModal
        visible={showDetails}
        onClose={() => setShowDetails(false)}
        confidence={confidence}
        ingredients={ingredients}
      />
    </View>
  );
}

/**
 * Breakdown item for quick stats
 */
function BreakdownItem({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  if (count === 0) return null;

  return (
    <View style={styles.breakdownItem}>
      <View style={[styles.breakdownDot, { backgroundColor: color }]} />
      <Text style={styles.breakdownText}>
        {count} {label}
      </Text>
    </View>
  );
}

/**
 * Modal showing full confidence details
 */
function ConfidenceDetailsModal({
  visible,
  onClose,
  confidence,
  ingredients,
}: {
  visible: boolean;
  onClose: () => void;
  confidence: MacroConfidenceData;
  ingredients: IngredientDetail[];
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Macro Accuracy Details</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{'\u2715'}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Overall score */}
          <View style={styles.scoreSection}>
            <View
              style={[
                styles.scoreCircle,
                { borderColor: CONFIDENCE_COLORS[confidence.overall] },
              ]}
            >
              <Text
                style={[
                  styles.scoreNumber,
                  { color: CONFIDENCE_COLORS[confidence.overall] },
                ]}
              >
                {confidence.score}
              </Text>
              <Text style={styles.scoreLabel}>score</Text>
            </View>
            <Text style={styles.scoreExplanation}>
              {confidence.overall === 'high'
                ? 'These macros are calculated from reliable USDA data with accurate measurements.'
                : confidence.overall === 'medium'
                ? 'Some ingredients were estimated. Review flagged items for better accuracy.'
                : 'Several ingredients could not be accurately calculated. Consider manually verifying.'}
            </Text>
          </View>

          {/* Ingredient breakdown */}
          <Text style={styles.sectionTitle}>Ingredient Analysis</Text>

          {ingredients.map((ing, index) => (
            <IngredientConfidenceCard key={index} ingredient={ing} />
          ))}

          {/* How it works */}
          <View style={styles.howItWorks}>
            <Text style={styles.howItWorksTitle}>How accuracy is calculated</Text>
            <Text style={styles.howItWorksText}>
              {'\u2022'} We match each ingredient to USDA's FoodData Central database{'\n'}
              {'\u2022'} Quantities are converted using USDA portion data when available{'\n'}
              {'\u2022'} For volumetric measures (cups, tbsp), we use ingredient-specific densities{'\n'}
              {'\u2022'} Cooking adjustments account for water loss/gain during preparation
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Card showing individual ingredient confidence
 */
function IngredientConfidenceCard({
  ingredient,
}: {
  ingredient: IngredientDetail;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={[
        styles.ingredientCard,
        { borderLeftColor: CONFIDENCE_COLORS[ingredient.confidence] },
      ]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.ingredientHeader}>
        <View style={styles.ingredientInfo}>
          <Text style={styles.ingredientName}>{ingredient.original}</Text>
          <Text style={styles.ingredientMatch}>
            {ingredient.fdcMatch
              ? `Matched: ${ingredient.fdcMatch.description}`
              : 'No USDA match found'}
          </Text>
        </View>
        <View
          style={[
            styles.ingredientBadge,
            { backgroundColor: CONFIDENCE_BG_COLORS[ingredient.confidence] },
          ]}
        >
          <Text
            style={[
              styles.ingredientBadgeText,
              { color: CONFIDENCE_COLORS[ingredient.confidence] },
            ]}
          >
            {CONFIDENCE_ICONS[ingredient.confidence]}
          </Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.ingredientDetails}>
          {ingredient.grams && (
            <Text style={styles.detailText}>
              Weight: {ingredient.grams.toFixed(1)}g
            </Text>
          )}
          {ingredient.fdcMatch && (
            <Text style={styles.detailText}>
              Data source: {ingredient.fdcMatch.dataType} (score: {ingredient.fdcMatch.matchScore})
            </Text>
          )}
          {ingredient.macros && (
            <Text style={styles.detailText}>
              Macros: {ingredient.macros.calories.toFixed(0)} cal, {ingredient.macros.protein.toFixed(1)}g protein
            </Text>
          )}
          {ingredient.assumptions?.map((assumption, i) => (
            <Text key={i} style={styles.assumptionText}>
              {'\u2022'} {assumption}
            </Text>
          ))}
          {ingredient.warnings?.map((warning, i) => (
            <Text key={i} style={styles.warningText}>
              {'\u26A0'} {warning}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeIcon: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mainIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
  },
  mainIndicatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mainIcon: {
    fontSize: 24,
    fontWeight: '600',
  },
  mainLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  mainSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 16,
    color: '#9ca3af',
  },
  breakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownText: {
    fontSize: 13,
    color: '#4b5563',
  },
  issuesSummary: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  issuesTitle: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6b7280',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  scoreSection: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  scoreExplanation: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    marginTop: 8,
  },
  ingredientCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ingredientInfo: {
    flex: 1,
    marginRight: 8,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  ingredientMatch: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  ingredientBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ingredientDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailText: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 4,
  },
  assumptionText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
    paddingLeft: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#b45309',
    marginBottom: 2,
    paddingLeft: 8,
  },
  howItWorks: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  howItWorksText: {
    fontSize: 13,
    color: '#1e3a8a',
    lineHeight: 20,
  },
});

export default MacroConfidence;
