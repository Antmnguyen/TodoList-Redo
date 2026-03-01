// app/components/categories/CategorySelector.tsx
// =============================================================================
// CATEGORY SELECTOR COMPONENT
// =============================================================================
//
// Reusable expandable category picker used in:
//   - CreateTaskScreen (one-off tasks)
//   - CreatePermanentTaskScreen (permanent task templates)
//
// Props:
//   - selectedCategory: currently selected category (or null)
//   - onSelectCategory: callback when category is selected/deselected
//   - categories: list of categories to display
//   - loading: whether categories are still loading
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Category } from '../../features/categories';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface CategorySelectorProps {
  selectedCategory: Category | null;
  onSelectCategory: (category: Category | null) => void;
  categories: Category[];
  loading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategory,
  onSelectCategory,
  categories,
  loading = false,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [expanded, setExpanded] = useState(false);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleCategoryPress = (cat: Category) => {
    // Toggle: tap again to deselect
    onSelectCategory(selectedCategory?.id === cat.id ? null : cat);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View>
      {/* Expandable header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View>
          <Text style={styles.label}>CATEGORY</Text>
          <View style={styles.valueRow}>
            {selectedCategory?.color && (
              <View
                style={[styles.colorDot, { backgroundColor: selectedCategory.color }]}
              />
            )}
            <Text style={styles.value}>
              {selectedCategory?.name || 'None'}
            </Text>
          </View>
        </View>
        <Text style={styles.expandIcon}>{expanded ? '−' : '+'}</Text>
      </TouchableOpacity>

      {/* Category list (shown when expanded) */}
      {expanded && (
        <View style={styles.listContainer}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.accent} style={styles.loading} />
          ) : categories.length === 0 ? (
            <Text style={styles.emptyText}>
              No categories yet. Add categories to organize your tasks.
            </Text>
          ) : (
            categories.map((cat) => {
              const isSelected = selectedCategory?.id === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.item,
                    isSelected && styles.itemSelected,
                    isSelected && cat.color && { backgroundColor: cat.color },
                  ]}
                  onPress={() => handleCategoryPress(cat)}
                >
                  {cat.color && !isSelected && (
                    <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                  )}
                  <Text
                    style={[
                      styles.itemText,
                      isSelected && styles.itemTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    // Header (always visible)
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.bgCard,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginTop: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    value: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    expandIcon: {
      fontSize: 20,
      color: theme.accent,
      fontWeight: '300',
    },

    // Color indicator dot
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 8,
    },

    // List container (shown when expanded)
    listContainer: {
      backgroundColor: theme.bgCard,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    loading: {
      paddingVertical: 16,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textTertiary,
      paddingVertical: 12,
    },

    // Individual category item
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: theme.bgInput,
      marginBottom: 8,
    },
    itemSelected: {
      backgroundColor: theme.accent,
    },
    itemText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    itemTextSelected: {
      color: '#fff',
    },
  });
}
