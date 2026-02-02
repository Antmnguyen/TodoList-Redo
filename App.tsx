// App.tsx
// =============================================================================
// APP ENTRY POINT
// =============================================================================
//
// TEMPORARY CHANGE FOR TESTING (UI Sprint 3):
// - Changed from: import { HomeScreen } from './app/screens/HomeScreen';
// - Changed to:   import { AllTasksScreen } from './app/screens/tasks/AllTasksScreen';
//
// This bypasses the normal navigation flow and loads AllTasksScreen directly
// so we can test the new FloatingCreateTaskButton with its popup menu.
//
// TO REVERT: Change the import back to HomeScreen and return <HomeScreen />
// =============================================================================

import React from 'react';
import { TasksStack } from './app/navigation/stacks/TasksStack';
import { initializeAllSchemas } from './app/core/services/storage/schema';

// Initialize database tables before the app renders
initializeAllSchemas();

export default function App() {
  // TasksStack handles all task-related screens and the FAB navigation
  return <TasksStack />;
}
