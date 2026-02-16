// app/navigation/stacks/TasksStack.tsx
// =============================================================================
// TASKS STACK NAVIGATOR
// =============================================================================
//
// Handles navigation for all task-related screens.
// The FloatingCreateTaskButton lives here so it can be shared across screens
// and trigger navigation to Create/Use permanent task screens.
//
// SCREENS IN THIS STACK:
// - AllTasks: Main task list (default)
// - CreateTask: Create a new task (name + due date + type)
// - CreatePermanentTask: Create a new permanent task template
// - UsePermanentTask: Select and use an existing template
//
// The FAB is rendered as an overlay on top of the current screen.
// =============================================================================

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AllTasksScreen } from '../../screens/tasks/AllTasksScreen';
import { CreatePermanentTaskScreen, PermanentTaskFormData } from '../../screens/tasks/CreatePermanentTaskScreen';
import { UsePermanentTaskScreen } from '../../screens/tasks/UsePermanentTaskScreen';
import { CreateTaskScreen, CreateTaskFormData } from '../../screens/tasks/CreateTaskScreen';
import { FloatingCreateTaskButton } from '../../components/tasks/FloatingCreateTaskButton';
import { CreateTaskModal } from '../../components/tasks/CreateTaskModal';
import { createTask } from '../../core/domain/taskActions';
import { Task } from '../../core/types/task';

// =============================================================================
// TYPES
// =============================================================================

type TasksScreen = 'AllTasks' | 'CreateTask' | 'CreatePermanentTask' | 'UsePermanentTask';

// =============================================================================
// COMPONENT
// =============================================================================

export const TasksStack: React.FC = () => {
  // Current screen in the stack
  const [currentScreen, setCurrentScreen] = useState<TasksScreen>('AllTasks');

  // Key to force AllTasksScreen to remount and refresh data
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal for creating one-off tasks (shown over any screen)
  const [createTaskModalVisible, setCreateTaskModalVisible] = useState(false);

  // =========================================================================
  // NAVIGATION HANDLERS
  // =========================================================================

  const navigateTo = (screen: TasksScreen) => {
    setCurrentScreen(screen);
  };

  const goBack = () => {
    console.log('TasksStack: goBack called, navigating to AllTasks');
    setCurrentScreen('AllTasks');
  };

  // =========================================================================
  // FAB ACTION HANDLERS
  // =========================================================================

  // Navigates to CreateTaskScreen (full screen with name, date, type)
  const handleCreateTask = () => {
    navigateTo('CreateTask');
  };

  // Navigates to UsePermanentTaskScreen
  const handleUsePermanentTask = () => {
    navigateTo('UsePermanentTask');
  };

  // Navigates to CreatePermanentTaskScreen
  const handleCreatePermanentTask = () => {
    navigateTo('CreatePermanentTask');
  };

  // =========================================================================
  // SCREEN CALLBACKS
  // =========================================================================

  // Called when one-off task is created via modal
  const handleSubmitOneOffTask = async (title: string) => {
    await createTask(title, 'one_off');
    setCreateTaskModalVisible(false);
    setRefreshKey(prev => prev + 1); // Refresh task list
  };

  // Called when a task is created via CreateTaskScreen
  // -------------------------------------------------------------------------
  // DATA FLOW:
  //   CreateTaskScreen.handleSave() emits CreateTaskFormData via onSave prop
  //   → This function receives { title, dueDate, category }
  //   → Calls createTask() to save to database
  //   → Refreshes task list and navigates back
  //
  // FUNCTIONS CALLED:
  //   createTask(title, kind, additionalData)
  //     - Location: app/core/domain/taskActions.ts
  //     - Creates a Task object via TaskFactory.create()
  //     - Merges additionalData (dueDate, category) into the task
  //     - Calls saveTask() to persist to SQLite
  //
  //   saveTask(task)
  //     - Location: app/core/services/storage/taskStorage.ts
  //     - Writes to 'tasks' table: id, title, completed, created_at, due_date
  //     - Note: 'category' is on Task type but not in DB schema yet
  //
  // PARAMETERS:
  //   data.title    - Task name (required, from text input)
  //   data.dueDate  - Due date (Date object, defaults to today)
  //   data.category - Task category (optional, e.g. "Workout", "School")
  // -------------------------------------------------------------------------
  const handleCreateTaskSave = async (data: CreateTaskFormData) => {
    // Save task to database via taskActions → taskStorage → SQLite
    await createTask(data.title, 'one_off', {
      dueDate: data.dueDate,
      category: data.category,
    });

    // Increment refreshKey to force AllTasksScreen to remount and reload tasks
    setRefreshKey(prev => prev + 1);

    // Navigate back to AllTasksScreen
    goBack();
  };

  // Called when permanent task template is saved
  const handlePermanentTaskSave = (data: PermanentTaskFormData) => {
    console.log('Permanent task template saved:', data);
    goBack();
  };

  // Called when permanent task instance is created
  const handleInstanceCreated = (task: Task) => {
    console.log('Permanent task instance created:', task);
    setRefreshKey(prev => prev + 1); // Force AllTasksScreen to remount and reload
    goBack();
  };

  // =========================================================================
  // RENDER CURRENT SCREEN
  // =========================================================================

  const renderScreen = () => {
    switch (currentScreen) {
      case 'CreateTask':
        return (
          <CreateTaskScreen
            onSave={handleCreateTaskSave}
            onCancel={goBack}
          />
        );

      case 'CreatePermanentTask':
        return (
          <CreatePermanentTaskScreen
            onSave={handlePermanentTaskSave}
            onCancel={goBack}
          />
        );

      case 'UsePermanentTask':
        return (
          <UsePermanentTaskScreen
            onInstanceCreated={handleInstanceCreated}
            onCancel={goBack}
          />
        );

      case 'AllTasks':
      default:
        return <AllTasksScreen key={refreshKey} />;
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  // Only show FAB on AllTasks screen (not on create/use screens which have their own headers)
  const showFAB = currentScreen === 'AllTasks';

  return (
    <View style={styles.container}>
      {/* Current Screen */}
      {renderScreen()}

      {/* Floating Action Button - only on main screen */}
      {showFAB && (
        <FloatingCreateTaskButton
          color="#007AFF"
          onCreateTask={handleCreateTask}
          onUsePermanentTask={handleUsePermanentTask}
          onCreatePermanentTask={handleCreatePermanentTask}
        />
      )}

      {/* Create Task Modal - can appear over any screen */}
      <CreateTaskModal
        visible={createTaskModalVisible}
        onClose={() => setCreateTaskModalVisible(false)}
        onSubmit={handleSubmitOneOffTask}
      />
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
