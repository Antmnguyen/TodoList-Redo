// app/components/tasks/TaskList.tsx
// =============================================================================
// TASK LIST COMPONENT
// =============================================================================
//
// Presentational list of tasks. No hooks; receives tasks and callbacks via props.
//
// CALLBACKS:
//   onToggle - Called when checkbox is tapped
//   onDelete - Called when delete button is tapped
//   onEdit   - Called when task body is tapped (opens edit modal)
//
// =============================================================================

import React from 'react';
import { FlatList, View, StyleSheet, ListRenderItem } from 'react-native';
import { TaskItem } from './TaskItem';
import { Task } from '../../core/types/task';
import { EmptyState } from '../feedback/EmptyState';

export type TaskListProps = {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (task: Task) => void;  // Optional: opens edit modal
  /** Optional empty message when tasks.length === 0 */
  emptyMessage?: string;
};

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onToggle,
  onDelete,
  onEdit,
  emptyMessage = 'No tasks yet',
}) => {
  const renderItem: ListRenderItem<Task> = ({ item }) => (
    <TaskItem task={item} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
  );

  return (
    <FlatList
      data={tasks}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={[styles.list, tasks.length === 0 && styles.listEmpty]}
      ListEmptyComponent={<EmptyState message={emptyMessage} />}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  listEmpty: {
    flexGrow: 1,
  },
});
