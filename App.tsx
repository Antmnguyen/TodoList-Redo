// App.tsx
// =============================================================================
// APP ENTRY POINT
// =============================================================================
//
// Root component that initializes the database and renders the main navigator.
//
// NAVIGATION STRUCTURE:
//   App.tsx
//     └── MainNavigator (bottom tab bar)
//           ├── TasksStack (All Tasks tab)
//           │     ├── AllTasksScreen
//           │     ├── CreateTaskScreen
//           │     ├── CreatePermanentTaskScreen
//           │     └── UsePermanentTaskScreen
//           ├── TodayScreen (Today tab)
//           ├── StatsScreen (Stats tab)
//           └── BrowseScreen (Browse tab)
//
// =============================================================================

import React from 'react';
import { MainNavigator } from './app/navigation/MainNavigator';
import { initializeAllSchemas } from './app/core/services/storage/schema';

// Initialize database tables before the app renders
initializeAllSchemas();

export default function App() {
  // MainNavigator handles bottom tab bar and all screen navigation
  // Location: app/navigation/MainNavigator.tsx
  return <MainNavigator />;
}
