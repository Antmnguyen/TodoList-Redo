// app/screens/browse/CategoryManagementScreen.tsx
// =============================================================================
// CATEGORY MANAGEMENT SCREEN
// =============================================================================
//
// Full-screen view for managing categories:
//   - Lists all categories with color, name, task count
//   - Add button → AddCategoryModal (create mode)
//   - Tap edit icon → AddCategoryModal (edit mode)
//   - Tap delete icon → confirmation → delete
//
// Navigation: opened from BrowseScreen via local state (no React Navigation)
//
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';

import { useCategories } from '../../features/categories';
import { Category } from '../../features/categories';
import { getTaskCountForCategory, getTasksForCategory } from '../../core/services/storage/categoryStorage';
import { CategoryListItem } from '../../components/categories/CategoryListItem';
import { AddCategoryModal } from '../../components/categories/AddCategoryModal';

// =============================================================================
// TYPES
// =============================================================================

export interface CategoryManagementScreenProps {
  onBack: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CategoryManagementScreen: React.FC<CategoryManagementScreenProps> = ({
  onBack,
}) => {
  // ---------------------------------------------------------------------------
  // Hook
  // ---------------------------------------------------------------------------
  const { categories, loading, addCategory, editCategory, removeCategory } = useCategories();

  // ---------------------------------------------------------------------------
  // Task count state (per category)
  // ---------------------------------------------------------------------------
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadTaskCounts();
  }, [categories]);

  async function loadTaskCounts() {
    const counts: Record<string, number> = {};
    await Promise.all(
      categories.map(async (cat) => {
        counts[cat.id] = await getTaskCountForCategory(cat.id);
      })
    );
    setTaskCounts(counts);
  }

  // ---------------------------------------------------------------------------
  // Task list modal state
  // ---------------------------------------------------------------------------
  type TaskRow = { id: string; title: string; completed: boolean };
  const [taskListCategory, setTaskListCategory] = useState<Category | null>(null);
  const [taskListItems, setTaskListItems] = useState<TaskRow[]>([]);

  const openTaskList = (category: Category) => {
    const tasks = getTasksForCategory(category.id);
    setTaskListItems(tasks);
    setTaskListCategory(category);
  };

  const closeTaskList = () => setTaskListCategory(null);

  // ---------------------------------------------------------------------------
  // Add / Edit modal state
  // ---------------------------------------------------------------------------
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const openAddModal = () => {
    setEditingCategory(null);
    setModalVisible(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingCategory(null);
  };

  // ---------------------------------------------------------------------------
  // CRUD handlers
  // ---------------------------------------------------------------------------
  const handleSave = async (name: string, color: string) => {
    try {
      if (editingCategory) {
        await editCategory(editingCategory.id, { name, color });
      } else {
        await addCategory(name, color);
      }
      closeModal();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save category');
    }
  };

  const handleDelete = async (category: Category) => {
    try {
      await removeCategory(category.id);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to delete category');
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Categories</Text>
        <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
          <Text style={styles.addText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Category list */}
      {loading ? (
        <ActivityIndicator size="large" color="#5856D6" style={styles.loader} />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CategoryListItem
              category={item}
              taskCount={taskCounts[item.id] ?? 0}
              onPress={openTaskList}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No categories yet.</Text>
              <Text style={styles.emptySubText}>Tap "+ Add" to create one.</Text>
            </View>
          }
          contentContainerStyle={categories.length === 0 ? styles.emptyContainer : null}
        />
      )}

      {/* Task list modal */}
      <Modal
        visible={taskListCategory !== null}
        transparent
        animationType="slide"
        onRequestClose={closeTaskList}
      >
        <View style={styles.taskModalOverlay}>
          <View style={styles.taskModalSheet}>
            {/* Modal header */}
            <View style={styles.taskModalHeader}>
              <View style={[styles.taskModalDot, { backgroundColor: taskListCategory?.color || '#ccc' }]} />
              <Text style={styles.taskModalTitle}>{taskListCategory?.name}</Text>
              <TouchableOpacity onPress={closeTaskList} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.taskModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Task list */}
            {taskListItems.length === 0 ? (
              <Text style={styles.taskModalEmpty}>No tasks in this category.</Text>
            ) : (
              <FlatList
                data={taskListItems}
                keyExtractor={(t) => t.id}
                renderItem={({ item }) => (
                  <View style={styles.taskRow}>
                    <Text style={styles.taskDot}>{item.completed ? '✓' : '○'}</Text>
                    <Text style={[styles.taskTitle, item.completed && styles.taskTitleDone]}>
                      {item.title}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Add / Edit modal */}
      <AddCategoryModal
        visible={modalVisible}
        initialCategory={editingCategory}
        onSave={handleSave}
        onCancel={closeModal}
      />
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#5856D6',
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  addBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  addText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  loader: {
    marginTop: 60,
  },
  emptyContainer: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
  },

  // Task list modal
  taskModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  taskModalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  taskModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  taskModalDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  taskModalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  taskModalClose: {
    fontSize: 18,
    color: '#aaa',
  },
  taskModalEmpty: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 24,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskDot: {
    fontSize: 16,
    color: '#888',
    marginRight: 12,
    width: 20,
    textAlign: 'center',
  },
  taskTitle: {
    fontSize: 15,
    color: '#1a1a1a',
    flex: 1,
  },
  taskTitleDone: {
    color: '#aaa',
    textDecorationLine: 'line-through',
  },
});
