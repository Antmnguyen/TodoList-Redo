// app/components/tasks/TaskList.tsx
// Presentational list of tasks. No hooks; receives tasks and callbacks via props.

import React from 'react';
import { FlatList, View, StyleSheet, ListRenderItem } from 'react-native';
import { TaskItem } from './Taskitem';
import { Task } from '../../core/types/task';
import { EmptyState } from '../feedback/EmptyState';

export type TaskListProps = {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  /** Optional empty message when tasks.length === 0 */
  emptyMessage?: string;
};

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onToggle,
  onDelete,
  emptyMessage = 'No tasks yet',
}) => {
  const renderItem: ListRenderItem<Task> = ({ item }) => (
    <TaskItem task={item} onToggle={onToggle} onDelete={onDelete} />
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
