// app/components/categories/CategoryListItem.tsx
// =============================================================================
// CATEGORY LIST ITEM
// =============================================================================
//
// Displays a single category row in the management list:
//   - Color dot + name + task count
//   - Edit button (pencil icon)
//   - Delete button (trash icon)
//
// =============================================================================

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Category } from '../../features/categories';

// =============================================================================
// TYPES
// =============================================================================

export interface CategoryListItemProps {
  category: Category;
  taskCount: number;
  onPress: (category: Category) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CategoryListItem: React.FC<CategoryListItemProps> = ({
  category,
  taskCount,
  onPress,
  onEdit,
  onDelete,
}) => {
  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleDelete = () => {
    Alert.alert(
      'Delete Category',
      `Delete "${category.name}"? Tasks in this category will be uncategorized.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(category),
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View style={styles.row}>
      {/* Tappable left side: color dot + name + count */}
      <TouchableOpacity
        style={styles.rowBody}
        onPress={() => onPress(category)}
        activeOpacity={0.6}
      >
        <View
          style={[
            styles.colorDot,
            { backgroundColor: category.color || '#ccc' },
          ]}
        />
        <View style={styles.info}>
          <Text style={styles.name}>{category.name}</Text>
          <Text style={styles.count}>
            {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Actions */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onEdit(category)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.editIcon}>✏️</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={handleDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.deleteIcon}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 14,
  },
  info: {
    flex: 1,
    flexShrink: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  count: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  actionBtn: {
    paddingHorizontal: 8,
  },
  editIcon: {
    fontSize: 18,
  },
  deleteIcon: {
    fontSize: 18,
  },
});
