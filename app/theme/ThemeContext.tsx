// app/theme/ThemeContext.tsx
// =============================================================================
// THEME CONTEXT
// =============================================================================
//
// Provides the active AppTheme to the whole component tree via React context.
//
// MANUAL TOGGLE (not system-following):
//   The user's dark-mode preference is persisted in app_settings under the
//   key 'dark_mode' ('1' = dark, '0' = light). On first launch, falls back to
//   the device's system colour scheme. The toggle in BrowseScreen calls
//   toggleTheme() which flips the state and writes to storage immediately.
//
// USAGE:
//   // Reading the theme anywhere in the tree:
//   const { theme, isDark, toggleTheme } = useTheme();
//
//   // Wrapping the app root (App.tsx):
//   <ThemeProvider><App /></ThemeProvider>
// =============================================================================

import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, AppTheme } from './tokens';
import { getAppSetting, setAppSetting } from '../core/services/storage/appSettingsStorage';

// Key used to persist the user's preference in app_settings.
const DARK_MODE_KEY = 'dark_mode';

// =============================================================================
// CONTEXT TYPE
// =============================================================================

interface ThemeContextValue {
  /** Active colour palette — use this to read token values. */
  theme:       AppTheme;
  /** true when dark mode is active. */
  isDark:      boolean;
  /** Flip dark/light and persist the new preference immediately. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:       lightTheme,
  isDark:      false,
  toggleTheme: () => {},
});

// =============================================================================
// PROVIDER
// =============================================================================

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // useColorScheme() gives the device system preference.
  // Only used as a fallback if the user has never set a preference.
  const systemScheme = useColorScheme();

  // Initialise synchronously from storage.
  // getAppSetting is a synchronous SQLite call — safe to call in useState init.
  // app_settings schema is initialised before App renders (App.tsx calls
  // initializeAllSchemas() at module level), so this read is always safe.
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = getAppSetting(DARK_MODE_KEY);
    if (stored !== null) {
      // User has an explicit preference stored — honour it.
      return stored === '1';
    }
    // First launch: mirror the system setting.
    return systemScheme === 'dark';
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      // Persist immediately so the preference survives cold starts.
      setAppSetting(DARK_MODE_KEY, next ? '1' : '0');
      return next;
    });
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Returns the active theme palette, the isDark flag, and toggleTheme.
 * Must be called inside a component that is a descendant of ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
