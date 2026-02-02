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
import { AllTasksScreen } from './app/screens/tasks/AllTasksScreen';
import { initializeAllSchemas } from './app/core/services/storage/schema';

// Initialize database tables before the app renders
// Sprint 2: database initialize all schema
initializeAllSchemas(); // function located in services/storage/schema.ts

export default function App() {
  // TEMPORARY: Loading AllTasksScreen directly for testing the floating button
  // In production, this should return the navigation stack (AppNavigator/TabNavigator)
  return <AllTasksScreen />;
}
