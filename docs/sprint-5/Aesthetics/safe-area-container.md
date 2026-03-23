# Safe Area Container — Universal Screen Box

> **Status: COMPLETE** — All screens migrated. Status-bar colour fill and dynamic FAB/TabBar positioning also implemented.

---

## Problem

`app.json` sets `android.edgeToEdgeEnabled: true`. This makes the app render
**behind** the OS status bar (top) and the OS navigation bar (bottom gesture
strip or 3-button row). The exact heights of these areas vary per device —
notch size, punch-hole camera, gesture vs. button navigation, etc.

The old `SafeAreaView` import in most screens came from **`react-native`**,
not from `react-native-safe-area-context`. In edge-to-edge mode, the
`react-native` version does not correctly read insets from the `SafeAreaProvider`
that lives at the app root. The result was:

- On some devices, screen content hidden behind the notification bar (top)
- On some devices, the bottom of content hidden behind the gesture strip
- Hard-coded `paddingTop` workarounds only worked on the device they were tested on

---

## Solution: `Screen` Wrapper Component

**File:** `app/components/layout/Screen.tsx`

A single thin wrapper that every screen uses instead of raw `SafeAreaView`.
It automatically insets content using real device values from `SafeAreaProvider`,
and optionally fills the status-bar slot with a specific colour so there is no
blank gap between the OS bar and the screen's header.

### Final implementation

```tsx
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge, useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps {
  children:  React.ReactNode;
  style?:    ViewStyle;
  edges?:    Edge[];
  /** Fills the status-bar inset area with this colour — does NOT affect content below */
  topColor?: string;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
  topColor,
}) => {
  const insets = useSafeAreaInsets();

  // When topColor is set we handle the top inset with a plain coloured View,
  // so remove 'top' from SafeAreaView edges to avoid double-padding.
  const effectiveEdges = topColor
    ? (edges.filter(e => e !== 'top') as Edge[])
    : edges;

  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={effectiveEdges}>
      {topColor && (
        <View style={{ height: insets.top, backgroundColor: topColor }} />
      )}
      {children}
    </SafeAreaView>
  );
};
```

### Why `topColor` works without bleeding into content

Setting `backgroundColor` directly on `SafeAreaView` fills the *entire*
container, causing the header colour to bleed down into list/scroll areas
wherever children are transparent. `topColor` instead renders a `View` that
is *exactly* `insets.top` pixels tall — only the status-bar slot — and the
SafeAreaView's own top edge padding is removed to prevent double-spacing.
The content area's background is never touched.

---

## Edges Guide

| Screen type | `edges` value | Reason |
|---|---|---|
| Tab screens (AllTasks, Today, Stats, Browse) | `['top']` | Custom TabBar sits above the OS nav bar; no bottom inset needed from the screen itself |
| Overlay screens (CreateTask, UsePermanentTask, CreatePermanentTask, EditPermanentTask) | `['top', 'bottom']` | Tab bar is hidden; need both OS chrome edges |
| Browse sub-screens (Category, History, Location, Health) | `['top']` | Rendered inside BrowseScreen; back-navigation means no bottom tab bar |
| Detail screens (Overall, Permanent, Category detail) | `['bottom']` | `DetailHeader` already calls `useSafeAreaInsets()` for the top |

---

## Migration Applied

### Padding hacks removed

| File | Old hack | New value |
|---|---|---|
| `AllTasksScreen.tsx` | `paddingTop: 60` on header | removed (kept `padding: 20`) |
| `TodayScreen.tsx` | `paddingTop: 60` on header | removed (kept `padding: 20`) |
| `StatsScreen.tsx` | `paddingTop: 60` on header | removed (kept `padding: 20`) |
| `BrowseScreen.tsx` | `paddingTop: 60` on header | → `paddingTop: 20` |
| `CreateTaskScreen.tsx` | `paddingTop: 50, paddingBottom: 12` on header | → `paddingVertical: 12` |
| `CreatePermanentTaskScreen.tsx` | `paddingTop: 50, paddingBottom: 12` on header | → `paddingVertical: 12` |
| `UsePermanentTaskScreen.tsx` | `paddingTop: 50, paddingBottom: 12` on header | → `paddingVertical: 12` |
| `CategoryManagementScreen.tsx` | `paddingTop: 60, paddingBottom: 16` on header | → `paddingVertical: 12` |
| `HistoryManagementScreen.tsx` | `paddingTop: 60, paddingBottom: 16` on header | → `paddingVertical: 12` |
| `LocationManagementScreen.tsx` | `paddingTop: 60, paddingBottom: 16` on header | → `paddingVertical: 12` |
| `HealthManagementScreen.tsx` | `paddingTop: 60, paddingBottom: 16` on header | → `paddingVertical: 12` |

### UsePermanentTaskScreen — modal SafeAreaView

The inner `<SafeAreaView>` inside the `<Modal>` in this file was changed from
the `react-native` import to `react-native-safe-area-context`. The outer root
was replaced with `<Screen>` as normal.

---

## Status-Bar Colour Fill (`topColor`)

Each screen with a brand-colour header passes `topColor` matching that header,
so the status-bar slot is seamlessly filled:

| Screen | `topColor` |
|---|---|
| AllTasksScreen | `#007AFF` |
| TodayScreen | `ACCENT` (`#34C759`) |
| StatsScreen | `#FF9500` |
| BrowseScreen | `#5856D6` |
| CategoryManagementScreen | `#5856D6` |
| HistoryManagementScreen | `#5856D6` |
| LocationManagementScreen | `#5856D6` |
| HealthManagementScreen | `#5856D6` |
| CreateTaskScreen | `theme.bgCard` |
| CreatePermanentTaskScreen | `theme.bgCard` |
| UsePermanentTaskScreen | `theme.bgCard` |
| EditPermanentTaskScreen | `theme.bgCard` |

Detail screens (`edges={['bottom']}`) do not need `topColor` because
`DetailHeader` already handles the top inset internally.

---

## TabBar — Dynamic Bottom Inset

**File:** `app/components/navigation/TabBar.tsx`

`useSafeAreaInsets()` is called inside the component. The container height and
bottom padding grow with the device's bottom inset so icons never sit behind
the OS gesture strip:

```tsx
const insets = useSafeAreaInsets();
const styles = useMemo(() => makeStyles(theme, insets.bottom), [theme, insets.bottom]);

// in makeStyles:
container: {
  height: 65 + bottomInset,
  paddingBottom: bottomInset,
  ...
}
```

The old `paddingBottom: 12` hack on individual tab items was removed.

---

## FAB — Dynamic Bottom Position

**File:** `app/components/tasks/FloatingCreateTaskButton.tsx`

The FAB previously had `bottom: 90` hardcoded (65 px tab bar + 25 px margin).
Now it uses `useSafeAreaInsets()` so it always sits exactly 16 px above the
top edge of the tab bar regardless of device:

```tsx
const insets = useSafeAreaInsets();
const fabBottom = 65 + insets.bottom + 16;

// Applied inline:
style={[styles.fab, { bottom: fabBottom }]}

// Menu backdrop also tracks the FAB:
paddingBottom: fabBottom + 56 + 10   // FAB bottom + FAB height + gap
```

---

## Full Screen Checklist

### Tab screens — `edges: ['top']`
- [x] `app/screens/tasks/AllTasksScreen.tsx`
- [x] `app/screens/today/TodayScreen.tsx`
- [x] `app/screens/stats/StatsScreen.tsx`
- [x] `app/screens/browse/BrowseScreen.tsx`

### Overlay screens — `edges: ['top', 'bottom']`
- [x] `app/screens/tasks/CreateTaskScreen.tsx`
- [x] `app/screens/tasks/CreatePermanentTaskScreen.tsx`
- [x] `app/screens/tasks/UsePermanentTaskScreen.tsx`
- [x] `app/screens/tasks/EditPermanentTaskScreen.tsx`

### Browse sub-screens — `edges: ['top']`
- [x] `app/screens/browse/CategoryManagementScreen.tsx`
- [x] `app/screens/browse/HistoryManagementScreen.tsx`
- [x] `app/screens/browse/LocationManagementScreen.tsx`
- [x] `app/screens/browse/HealthManagementScreen.tsx`

### Detail screens — `edges: ['bottom']`
- [x] `app/screens/stats/detail/OverallDetailScreen.tsx`
- [x] `app/screens/stats/detail/PermanentDetailScreen.tsx`
- [x] `app/screens/stats/detail/CategoryDetailScreen.tsx`

### TabBar and FAB dynamic positioning
- [x] `app/components/navigation/TabBar.tsx` — `useSafeAreaInsets().bottom` for height + padding
- [x] `app/components/tasks/FloatingCreateTaskButton.tsx` — `fabBottom = 65 + insets.bottom + 16`

---

## Verification

1. Run on **gesture-nav** device — no content hidden behind status bar or gesture strip on any screen
2. Run on **3-button nav** device — no extra bottom gap
3. Open every **overlay screen** (CreateTask, UsePermanentTask, etc.) — header not obscured by the status bar
4. Open **Browse sub-screens** — header colour fills the status bar slot seamlessly
5. **Stat detail screens** — scroll content not clipped at the bottom
6. **TabBar** — icons don't sit behind the OS gesture strip; bar height adjusts dynamically
7. **FAB** — always 16 px clear of the tab bar top edge on all devices
