// app/screens/today/TodayScreen.tsx
// Today tab: useTasks + filtered list + FloatingCreateTaskButton + CreateTaskModal.

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTasks } from '../../core/hooks/useTasks';
import { TaskList } from '../../components/tasks/TaskList';
import { FloatingCreateTaskButton } from '../../components/tasks/FloatingCreateTaskButton';
import { CreateTaskModal } from '../../components/tasks/CreateTaskModal';

function isToday(d: Date): boolean {
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export const TodayScreen: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const { tasks, addTask, toggleTask, removeTask } = useTasks();

  const todayTasks = useMemo(
    () =>
      tasks.filter(
        t => isToday(new Date(t.createdAt)) || (t.dueDate && isToday(new Date(t.dueDate)))
      ),
    [tasks]
  );

  const handleSubmitTask = async (title: string) => {
    await addTask(title, 'one_off', { dueDate: new Date() });
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.subtitle}>
          {todayTasks.filter(t => !t.completed).length} to do
        </Text>
      </View>

      <TaskList
        tasks={todayTasks}
        onToggle={toggleTask}
        onDelete={removeTask}
        emptyMessage="Nothing for today. Tap + to add a task."
      />

      <FloatingCreateTaskButton onPress={() => setModalVisible(true)} />
      <CreateTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmitTask}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#34C759',
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#fff', opacity: 0.8 },
});
