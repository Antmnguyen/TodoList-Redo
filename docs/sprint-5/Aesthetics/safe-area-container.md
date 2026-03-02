# Safe Area Container — Universal Screen Box

> **Status: PLANNED** — Addresses OS chrome overlap on all devices.

---

## Problem

`app.json` sets `android.edgeToEdgeEnabled: true`. This makes the app render
**behind** the OS status bar (top) and the OS navigation bar (bottom gesture
strip or 3-button row). The exact heights of these areas vary per device —
notch size, punch-hole camera, gesture vs. button navigation, etc.

The current `SafeAreaView` import in most screens comes from **`react-native`**,
not from `react-native-safe-area-context`. In edge-to-edge mode, the
`react-native` version does not correctly read insets from the `SafeAreaProvider`
that lives at the app root. The result:

- On some devices, screen content is hidden behind the notification bar (top)
- On some devices, the bottom of content is hidden behind the gesture strip
- Hard-coded `paddingTop` workarounds only work on the device they were tested on

```
┌─────────────────────────────────────┐
│  ░░░ OS Status Bar (varies) ░░░░░░  │ ← app renders behind this
│  ← content starts here (variable!) │
│                                     │
│  ...screen content...               │
│                                     │
│  ← content ends here (variable!)   │
│  ░░░ OS Nav Bar / Gesture ░░░░░░░░  │ ← app renders behind this too
└─────────────────────────────────────┘
```

---

## Root Cause

| | `SafeAreaView` from `react-native` | `SafeAreaView` from `react-native-safe-area-context` |
|---|---|---|
| Reads from `SafeAreaProvider`? | ✗ No | ✓ Yes |
| Works with `edgeToEdgeEnabled`? | ✗ Unreliable | ✓ Yes |
| Already installed? | Built-in | ✓ Yes (v~5.6.0 in package.json) |
| `SafeAreaProvider` set up at root? | N/A | ✓ Yes (App.tsx) |

All the infrastructure for the correct fix is already in place.
The only change needed is to use the right import everywhere.

---

## Solution: `Screen` Wrapper Component

**File:** `app/components/layout/Screen.tsx` (exists, currently empty)

A single thin wrapper that every screen uses instead of `SafeAreaView` from
`react-native`. It automatically insets content away from OS chrome using
real device values from the `SafeAreaProvider`.

```tsx
import React from 'react';
import { ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

interface ScreenProps {
  children: React.ReactNode;
  style?:   ViewStyle;
  edges?:   Edge[];
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
}) => (
  <SafeAreaView style={[{ flex: 1 }, style]} edges={edges}>
    {children}
  </SafeAreaView>
);
```

The `edges` prop controls which sides get inset padding. Not every screen needs
all four edges — see the guide below.

---

## Edges Guide

| Screen type | `edges` value | Reason |
|---|---|---|
| Overlay screens (CreateTask, UsePermanentTask, CreatePermanentTask, EditPermanentTask) | `['top', 'bottom']` | Tab bar is hidden; need both OS chrome edges |
| Tab screens (AllTasks, Today, Stats, Browse) | `['top']` | Custom TabBar sits above the OS nav bar, no bottom inset needed from the screen |
| Browse sub-screens (Category, History, Location, Health) | `['top']` | Rendered inside BrowseScreen, which controls the bottom |
| Detail screens (Overall, Permanent, Category detail) | `['bottom']` | `DetailHeader` already uses `useSafeAreaInsets()` for the top |

---

## Migration: All Screens

### Step 1 — Replace the import

```tsx
// BEFORE (in most screens today)
import { SafeAreaView } from 'react-native';

// AFTER
import { Screen } from '../../components/layout/Screen';  // adjust path
```

### Step 2 — Replace the root element

```tsx
// BEFORE
<SafeAreaView style={styles.container}>
  ...
</SafeAreaView>

// AFTER
<Screen style={styles.container} edges={['top']}>
  ...
</Screen>
```

Remove `flex: 1` and `backgroundColor` from `styles.container` if they
duplicate what `Screen` already applies — or leave them; `Screen` merges styles
so duplicates are harmless.

### Step 3 — Remove manual `paddingTop` hacks

Once `Screen` provides real insets, the hard-coded offsets become wrong
(they add device-safe-area on top of the correct programmatic inset).

| File | Current hack | After migration |
|---|---|---|
| `CreateTaskScreen.tsx` | `paddingTop: 50` on `header` | → `paddingVertical: 12` |
| `CreatePermanentTaskScreen.tsx` | `paddingTop: 50` on `header` | → `paddingVertical: 12` |
| `UsePermanentTaskScreen.tsx` | `paddingTop: 50` on `header` | → `paddingVertical: 12` |
| `HistoryManagementScreen.tsx` | `paddingTop: 60` on `header` | → `paddingVertical: 12` |
| `BrowseScreen.tsx` | `paddingTop: 60` on `header` | → `paddingTop: 20` |

---

## Full Screen Checklist

### Tab screens — `edges: ['top']`
- [ ] `app/screens/tasks/AllTasksScreen.tsx`
- [ ] `app/screens/today/TodayScreen.tsx`
- [ ] `app/screens/stats/StatsScreen.tsx` *(uses correct import already — swap to `Screen`)*
- [ ] `app/screens/browse/BrowseScreen.tsx`

### Overlay screens — `edges: ['top', 'bottom']`
- [ ] `app/screens/tasks/CreateTaskScreen.tsx`
- [ ] `app/screens/tasks/CreatePermanentTaskScreen.tsx`
- [ ] `app/screens/tasks/UsePermanentTaskScreen.tsx`
- [ ] `app/screens/tasks/EditPermanentTaskScreen.tsx`

### Browse sub-screens — `edges: ['top']`
- [ ] `app/screens/browse/CategoryManagementScreen.tsx`
- [ ] `app/screens/browse/HistoryManagementScreen.tsx`
- [ ] `app/screens/browse/LocationManagementScreen.tsx`
- [ ] `app/screens/browse/HealthManagementScreen.tsx`

### Detail screens — `edges: ['bottom']`
- [ ] `app/screens/stats/detail/OverallDetailScreen.tsx`
- [ ] `app/screens/stats/detail/PermanentDetailScreen.tsx`
- [ ] `app/screens/stats/detail/CategoryDetailScreen.tsx`

### TabBar bottom inset (bonus)
- [ ] `app/components/navigation/TabBar.tsx` — add `useSafeAreaInsets().bottom`
  as padding below the tab icons so they don't sit behind the OS gesture strip

---

## Why Not Just Fix the Import?

Replacing `SafeAreaView` from `react-native` with `SafeAreaView` from
`react-native-safe-area-context` directly in each screen would also work.
The `Screen` wrapper is preferred because:

1. **One place to change** — if safe area behaviour needs updating (e.g. adding
   a `backgroundColor` that matches the header), it changes in one file.
2. **Self-documenting** — `<Screen edges={['top']}>` is more readable than
   `<SafeAreaView edges={['top']}>` from an unfamiliar package.
3. **The component already exists** — `Screen.tsx` is a placeholder created for
   exactly this purpose.

---

## Verification

After implementing:

1. Open every screen on a **gesture-navigation** device (no visible nav buttons)
   → no content hidden top or bottom
2. Open on a **3-button nav** device → same result
3. Test in **landscape** → side insets respected on notched devices
4. Toggle Dark Mode → inset areas match the screen background (no white/black
   strip at top or bottom)
5. Open CreateTask / UsePermanentTask (overlay screens) → header not blocked
   by status bar; bottom of form not blocked by nav bar
