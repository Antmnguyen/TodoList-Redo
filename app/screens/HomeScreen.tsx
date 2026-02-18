// app/screens/HomeScreen.tsx
// Uses useTasks, TaskList, FloatingCreateTaskButton + CreateTaskModal (reusable pattern).

import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTasks } from '../core/hooks/useTasks';
import { TaskList } from '../components/tasks/TaskList';
import { FloatingCreateTaskButton } from '../components/tasks/FloatingCreateTaskButton';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';

export const HomeScreen: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const { tasks, addTask, toggleTask, removeTask } = useTasks();

  const handleSubmitTask = async (title: string) => {
    await addTask(title, 'one_off');
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
        <Text style={styles.subtitle}>
          {tasks.filter(t => !t.completed).length} active
        </Text>
      </View>

      <TaskList
        tasks={tasks}
        onToggle={toggleTask}
        onDelete={removeTask}
        emptyMessage="No tasks yet. Tap + to add one."
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
    backgroundColor: '#007AFF',
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#fff', opacity: 0.8 },
});
