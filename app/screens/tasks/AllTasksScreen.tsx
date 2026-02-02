// app/screens/tasks/AllTasksScreen.tsx
// =============================================================================
// ALL TASKS SCREEN
// =============================================================================
//
// Screen that displays all tasks and provides access to task creation.
// Follows the architecture: screens use hooks for data, render components for UI.
//
// CHANGES MADE (UI Sprint 3):
// 1. Added Alert import for temporary placeholder handlers
// 2. Updated FloatingCreateTaskButton usage with new props:
//    - OLD: <FloatingCreateTaskButton onPress={() => setModalVisible(true)} />
//    - NEW: <FloatingCreateTaskButton
//             color="#007AFF"
//             onCreateTask={() => setModalVisible(true)}
//             onUsePermanentTask={handleUsePermanentTask}
//             onCreatePermanentTask={handleCreatePermanentTask}
//           />
// 3. Added CreatePermanentTaskScreen integration:
//    - Shows full-screen CreatePermanentTaskScreen when "Create permanent task" selected
//    - Uses conditional rendering (will be replaced with navigation later)
//
// NEXT STEPS:
// - Replace handleUsePermanentTask with navigation to permanent task selector
// - Replace conditional rendering with proper stack navigation
// - Connect CreatePermanentTaskScreen onSave to permanentTaskActions
// =============================================================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useTasks } from '../../core/hooks/useTasks';
import { TaskList } from '../../components/tasks/TaskList';
import { FloatingCreateTaskButton } from '../../components/tasks/FloatingCreateTaskButton';
import { CreateTaskModal } from '../../components/tasks/CreateTaskModal';
import { CreatePermanentTaskScreen, PermanentTaskFormData } from './CreatePermanentTaskScreen';

export const AllTasksScreen: React.FC = () => {
  // Modal visibility state for CreateTaskModal
  const [modalVisible, setModalVisible] = useState(false);

  // State to show CreatePermanentTaskScreen (temporary, will use navigation later)
  const [showCreatePermanentTask, setShowCreatePermanentTask] = useState(false);

  // Hook providing task data and operations
  const { tasks, addTask, toggleTask, removeTask } = useTasks();

  // Handler for creating a new one-off task via the modal
  const handleSubmitTask = async (title: string) => {
    await addTask(title, 'one_off');
    setModalVisible(false);
  };

  // TEMPORARY PLACEHOLDER: Will navigate to permanent task selector screen
  // TODO: Replace with actual navigation once the screen is created
  const handleUsePermanentTask = () => {
    Alert.alert('Use Permanent Task', 'This will open permanent task selector');
  };

  // Opens the CreatePermanentTaskScreen
  // TODO: Replace with navigation.navigate('CreatePermanentTask') when navigation is set up
  const handleCreatePermanentTask = () => {
    setShowCreatePermanentTask(true);
  };

  // Handler for when permanent task form is saved
  // TODO: Connect to permanentTaskActions.createTemplate()
  const handlePermanentTaskSave = (data: PermanentTaskFormData) => {
    console.log('Permanent task saved:', data);
    setShowCreatePermanentTask(false);
    // TODO: Call permanentTaskActions to save to backend
  };

  // Handler for when permanent task form is cancelled
  const handlePermanentTaskCancel = () => {
    setShowCreatePermanentTask(false);
  };

  // =========================================================================
  // CONDITIONAL RENDERING
  // If showCreatePermanentTask is true, render that screen instead
  // This is temporary - will be replaced with proper navigation later
  // =========================================================================
  if (showCreatePermanentTask) {
    return (
      <CreatePermanentTaskScreen
        onSave={handlePermanentTaskSave}
        onCancel={handlePermanentTaskCancel}
      />
    );
  }

  // =========================================================================
  // MAIN RENDER - All Tasks Screen
  // =========================================================================
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Tasks</Text>
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

      {/* FloatingCreateTaskButton - now shows a menu with 3 options when tapped */}
      <FloatingCreateTaskButton
        color="#007AFF"
        onCreateTask={() => setModalVisible(true)}         // Opens CreateTaskModal
        onUsePermanentTask={handleUsePermanentTask}        // TODO: Navigate to selector
        onCreatePermanentTask={handleCreatePermanentTask}  // Opens CreatePermanentTaskScreen
      />

      {/* Modal for creating one-off tasks */}
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
