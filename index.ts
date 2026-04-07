import { registerRootComponent } from 'expo';
import BackgroundFetch from 'react-native-background-fetch';

import App from './App';
import { sync } from './app/features/googleFit/utils/healthConnectActions';

// =============================================================================
// BACKGROUND FETCH — Health Connect periodic sync (S15)
// =============================================================================
//
// react-native-background-fetch schedules the OS to wake the app every
// ~15 minutes (the Android minimum) and run the provided callback. This ensures
// step/sleep data and task auto-completions stay up to date even when the user
// hasn't opened the app recently.
//
// Two registrations are needed:
//
//   BackgroundFetch.configure()  — fires when the app is alive (foreground or
//                                  suspended in background). Covers most users.
//
//   BackgroundFetch.registerHeadlessTask()  — fires when the app is FULLY
//                                  terminated (swiped away). Android only.
//                                  The JS engine spins up briefly, runs this
//                                  callback, then shuts down again.
//
// Both call sync() then BackgroundFetch.finish(taskId) to signal the OS that
// the work is done and the wake-lock can be released. Forgetting finish() causes
// the OS to throttle or stop scheduling future background tasks.
//
// The AndroidManifest service declaration for background-fetch was added during
// setup (Sprint 7 Phase 1). If the app fails to schedule, verify that
// com.transistorsoft.rnbackgroundfetch.BackgroundFetchHeadlessTask is declared
// in android/app/src/main/AndroidManifest.xml.
//
// Note: minimumFetchInterval is advisory — Android enforces a device-level
// minimum (typically 15 minutes) and may delay further due to battery optimisation.
// =============================================================================

BackgroundFetch.configure(
  {
    minimumFetchInterval: 15,  // minutes — Android enforces ≥ 15
    stopOnTerminate:      false, // continue scheduling even after app is swiped away
    startOnBoot:          true,  // reschedule after device reboot
    enableHeadless:       true,  // allow the headless task below to run when terminated
  },
  async (taskId) => {
    // The OS has woken the app for a background sync.
    // sync() is already guarded: it checks HC availability and exits cleanly
    // if the SDK isn't present or permissions aren't granted.
    await sync().catch(e => console.warn('[HC] Background sync failed:', e));
    // IMPORTANT: must call finish() or the OS will throttle future wake-ups
    BackgroundFetch.finish(taskId);
  },
  (taskId) => {
    // Timeout callback — the OS gave us too little time to complete.
    // Finish immediately so we don't hold a wake-lock we can't honour.
    console.warn('[HC] Background fetch timeout:', taskId);
    BackgroundFetch.finish(taskId);
  },
);

// Headless task — runs when the app is fully terminated (Android only).
// The JS engine boots, executes this function, and shuts down. No React tree
// is rendered; only synchronous DB calls and the HC async reads are safe here.
BackgroundFetch.registerHeadlessTask(async ({ taskId }) => {
  await sync().catch(e => console.warn('[HC] Headless sync failed:', e));
  BackgroundFetch.finish(taskId);
});

// =============================================================================
// APP REGISTRATION
// =============================================================================

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
registerRootComponent(App);
