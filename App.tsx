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
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MainNavigator } from './app/navigation/MainNavigator';
import { initializeAllSchemas } from './app/core/services/storage/schema';
import { ThemeProvider } from './app/theme/ThemeContext';

// Initialize database tables before the app renders.
// Must run before ThemeProvider mounts so app_settings (used to read the
// persisted dark-mode preference) is available synchronously.
initializeAllSchemas();

export default function App() {
  // ThemeProvider reads the persisted dark-mode preference from app_settings
  // and makes the active AppTheme available to the whole component tree via
  // useTheme(). It wraps SafeAreaProvider so both contexts are available to
  // all descendants.
  //
  // SafeAreaProvider must be at the root so any descendant can call
  // useSafeAreaInsets() without crashing.
  //
  // MainNavigator handles bottom tab bar and all screen navigation.
  // Location: app/navigation/MainNavigator.tsx
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <MainNavigator />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
