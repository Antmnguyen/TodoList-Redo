# Sprint 5 — Aesthetics Plan

> **Status: PLANNED** — No code written yet.

---

## Overview

Four pillars:

| # | Feature | Summary |
|---|---------|---------|
| 1 | **Dark Mode** | Full system-aware light/dark theme via a central theme context |
| 2 | **Category Color Strips** | Left accent strip on every task card and template row, coloured by the task's category |
| 3 | **Permanent vs One-Off Distinction** | Visual difference between recurring (permanent) tasks and one-off tasks in the task lists |
| 4 | **General Polish** | Completed task dimming, header consistency, empty state improvements |

---

## 1 — Dark Mode

### Goal
The app adapts automatically to the device's light/dark system setting.
Every hardcoded colour (`#fff`, `#f5f5f5`, `#000`, etc.) is replaced by a
theme token so a single context switch re-skins the entire app.

### Architecture

**New directory: `app/theme/`**

```
app/theme/
  tokens.ts          ← Light + dark colour palettes (plain objects, no React)
  ThemeContext.tsx   ← React context + ThemeProvider + useTheme() hook
```

#### `app/theme/tokens.ts`

Defines two palettes — same key names, different values:

```typescript
export const lightTheme = {
  // ── Backgrounds ──────────────────────────────
  bgScreen:    '#f5f5f5',   // page background (between cards)
  bgCard:      '#ffffff',   // white card / list row
  bgModal:     '#f5f5f5',   // modal sheet background
  bgInput:     '#f0f0f0',   // input field background
  bgSection:   '#ffffff',   // form section card

  // ── Surfaces / Headers ────────────────────────
  // NOTE: primary tab colours stay the same in dark mode
  // (they are brand colours, not semantic surfaces)
  headerTasks: '#007AFF',   // All Tasks blue
  headerToday: '#34C759',   // Today green
  headerStats: '#FF9500',   // Stats orange
  headerBrowse:'#5856D6',   // Browse purple

  // ── Text ──────────────────────────────────────
  textPrimary:    '#000000',
  textSecondary:  '#666666',
  textTertiary:   '#888888',
  textDisabled:   '#bbbbbb',
  textOnHeader:   '#ffffff',
  textOnAccent:   '#ffffff',

  // ── Interactive ───────────────────────────────
  accent:         '#007AFF',   // primary blue action
  accentPermanent:'#5856D6',   // purple — permanent task badge/checkbox
  danger:         '#FF3B30',   // delete button

  // ── Borders / Separators ──────────────────────
  border:         '#dddddd',
  separator:      '#f0f0f0',
  hairline:       '#cccccc',

  // ── Task Card specific ───────────────────────
  checkboxBorderOneOff:   '#007AFF',
  checkboxFillOneOff:     '#007AFF',
  checkboxBorderPermanent:'#5856D6',
  checkboxFillPermanent:  '#5856D6',
  completedText:          '#999999',
  completedStrike:        true,

  // ── Category strip (no-category fallback) ────
  categoryStripNone: '#e0e0e0',
};

export const darkTheme: typeof lightTheme = {
  bgScreen:    '#1c1c1e',
  bgCard:      '#2c2c2e',
  bgModal:     '#1c1c1e',
  bgInput:     '#3a3a3c',
  bgSection:   '#2c2c2e',

  headerTasks:  '#007AFF',
  headerToday:  '#34C759',
  headerStats:  '#FF9500',
  headerBrowse: '#5856D6',

  textPrimary:   '#ffffff',
  textSecondary: '#ababab',
  textTertiary:  '#888888',
  textDisabled:  '#555555',
  textOnHeader:  '#ffffff',
  textOnAccent:  '#ffffff',

  accent:          '#0a84ff',   // iOS dark-mode blue
  accentPermanent: '#6e6cd8',
  danger:          '#ff453a',

  border:    '#3a3a3c',
  separator: '#3a3a3c',
  hairline:  '#444446',

  checkboxBorderOneOff:    '#0a84ff',
  checkboxFillOneOff:      '#0a84ff',
  checkboxBorderPermanent: '#6e6cd8',
  checkboxFillPermanent:   '#6e6cd8',
  completedText:           '#555555',
  completedStrike:         true,

  categoryStripNone: '#444446',
};

export type AppTheme = typeof lightTheme;
```

#### `app/theme/ThemeContext.tsx`

```typescript
// Reads device colour scheme with useColorScheme().
// Wraps the whole app in ThemeProvider.
// useTheme() returns the active AppTheme object.

const ThemeContext = React.createContext<AppTheme>(lightTheme);

export function ThemeProvider({ children }) {
  const scheme = useColorScheme();   // 'light' | 'dark' | null
  const theme  = scheme === 'dark' ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}
```

`ThemeProvider` wraps the root in `App.tsx` (or wherever the root component lives).

#### Usage in components

Replace hardcoded colours with theme tokens:

```tsx
// BEFORE
container: { backgroundColor: '#fff' }
// AFTER
const theme = useTheme();
container: { backgroundColor: theme.bgCard }
```

Inline styles (for dynamic colours like category strip colours) use the same hook:

```tsx
const theme = useTheme();
<View style={{ width: 4, backgroundColor: task.categoryColor ?? theme.categoryStripNone }} />
```

---

## 2 — Category Color Strips

### Goal
Every task card shows a 4 px coloured left strip matching its category colour.
If the task has no category, the strip is neutral grey.
This appears in:
- `AllTasksScreen` (via `TaskItem`)
- `TodayScreen` (via `TaskItem`)
- `UsePermanentTaskScreen` template rows (template-level category, if set)

### Data Flow Problem

`Task.categoryId` is stored. `Task.categoryColor` is **not** — category colours
live in the `categories` table. The UI needs the colour at render time without a
separate query per task.

**Solution: denormalise `categoryColor` onto the Task at load time.**

In `taskStorage.ts → getAllTasks()`, change the SQL to LEFT JOIN categories:

```sql
SELECT t.*, c.color AS category_color
FROM tasks t
LEFT JOIN categories c ON t.category_id = c.id
ORDER BY t.created_at DESC
```

Then add `categoryColor` to the mapped row:

```typescript
categoryColor: row.category_color ?? undefined,
```

Add `categoryColor?: string` to the `Task` interface in `task.ts`.

The same JOIN is needed in `permanentTaskStorage.ts` for template loads
(so template rows in `UsePermanentTaskScreen` also get a colour).

### TaskItem Changes

`TaskItem` currently renders:

```
[ checkbox ] [ title + due date ] [ ✕ delete ]
```

New layout with colour strip:

```
[ 4px strip ] [ checkbox ] [ title + due date ] [ ✕ delete ]
```

The strip is a `View` with:
```typescript
{
  width: 4,
  alignSelf: 'stretch',
  backgroundColor: task.categoryColor ?? theme.categoryStripNone,
  borderTopLeftRadius: 8,
  borderBottomLeftRadius: 8,
  marginRight: 12,
}
```

The outer container `borderRadius: 8` already clips the corners — the strip
just needs matching `borderTopLeftRadius`/`borderBottomLeftRadius` on itself
so it curves with the card. No `overflow: 'hidden'` needed.

### Template Rows in UsePermanentTaskScreen

`renderTemplateItem` renders a `TouchableOpacity`. Same strip treatment:

```
[ 4px strip ] [ template name + location + usage count ] [ ⋮ menu ] [ › arrow ]
```

Strip colour = `item.categoryColor ?? theme.categoryStripNone`.

---

## 3 — Permanent vs One-Off Visual Distinction

### Goal
At a glance the user can tell which tasks are one-off vs recurring (permanent).
Two visual signals:

| Element | One-Off | Permanent |
|---------|---------|-----------|
| Checkbox border + fill | Blue (`#007AFF`) | Purple (`#5856D6`) |
| Type badge (optional) | _(none)_ | Small "↩" or "🔁" text badge next to title |

### Checkbox colour

In `TaskItem`, the checkbox `borderColor` and `backgroundColor` (when checked)
currently hardcode `#007AFF`. Change to:

```typescript
const checkboxColor = task.kind === 'permanent'
  ? theme.checkboxBorderPermanent
  : theme.checkboxBorderOneOff;
```

Apply `checkboxColor` to both `borderColor` (unchecked ring) and
`backgroundColor` (checked fill).

### Recurring badge

Optionally render a small badge to the right of the task title:

```tsx
{task.kind === 'permanent' && (
  <View style={styles.recurringBadge}>
    <Text style={styles.recurringBadgeText}>↩</Text>
  </View>
)}
```

Badge style: small grey pill, `fontSize: 10`, `color: theme.accentPermanent`.
Keeps the card clean — the checkbox colour alone is the primary signal;
the badge is secondary and very small.

Whether to include the badge is a design call — document it as optional here,
implement it if it looks good in practice.

---

## 4 — General Polish

### 4.1 Completed Task Dimming

Currently completed tasks use `line-through` + `color: #999` on the title.
Extend to also dim the entire card slightly:

```typescript
container: [
  styles.containerBase,
  task.completed && { opacity: 0.6 },
]
```

This works nicely in both light and dark mode without a separate dark theme
override. `opacity: 0.6` is enough to read the title while clearly conveying
"done".

### 4.2 Header Consistency

Current state:
- `AllTasksScreen` — blue `#007AFF`, large title, `paddingTop: 60`
- `TodayScreen` — green `#34C759`, large title, `paddingTop: 60`
- `UsePermanentTaskScreen` — white bar, standard iOS nav-bar style
- `HistoryManagementScreen` — purple `#5856D6`, back button, centred title

**Proposed standard for "big" tab headers (AllTasks, Today):**
```
paddingTop: 60  paddingHorizontal: 20  paddingBottom: 16
fontSize: 32 bold white title
fontSize: 16 white subtitle (count)
```
These two screens already match — keep them as-is.

**Proposed standard for "overlay" headers (UseTemplate, History, CreateTask, etc.):**
```
flexDirection: row  justifyContent: space-between
paddingHorizontal: 16  paddingVertical: 12
backgroundColor: theme.bgCard
borderBottom: hairline theme.hairline
```
Consistent across all overlay screens. Currently UseTemplate has a debug
`rgba(0,122,255,0.1)` background on header buttons — **remove this in
implementation** (it was noted as a debug visual in the source).

### 4.3 Empty State Improvements

Current empty states are plain centred text. Improve:
- Add an icon/emoji above the empty message (AllTasks: `📭`, Today: `☀️`)
- Use `theme.textSecondary` for the message colour
- Keep them simple — no elaborate illustration

### 4.4 BrowseScreen / CategoryManagementScreen

Category list rows in `CategoryManagementScreen` already show a colour dot.
No change needed there — the colour dot is already the category's hex colour.

---

## Files to Create / Modify

### New Files

| File | Purpose |
|------|---------|
| `app/theme/tokens.ts` | Light + dark colour palettes |
| `app/theme/ThemeContext.tsx` | React context, ThemeProvider, useTheme() |

### Modified Files

| File | Changes |
|------|---------|
| `App.tsx` (or root) | Wrap with `<ThemeProvider>` |
| `app/core/types/task.ts` | Add `categoryColor?: string` |
| `app/core/services/storage/taskStorage.ts` | JOIN categories, map `categoryColor` |
| `app/features/permanentTask/utils/permanentTaskActions.ts` | JOIN categories on template load |
| `app/components/tasks/TaskItem.tsx` | Category strip, perm/one-off checkbox colour, overdue highlight, completed dimming |
| `app/screens/tasks/AllTasksScreen.tsx` | Use theme tokens for bg + header |
| `app/screens/today/TodayScreen.tsx` | Use theme tokens for bg + header |
| `app/screens/tasks/UsePermanentTaskScreen.tsx` | Category strip on template rows, theme tokens, remove debug bg on header buttons |
| `app/screens/browse/HistoryManagementScreen.tsx` | Theme tokens |
| `app/screens/tasks/CreateTaskScreen.tsx` | Theme tokens |
| `app/screens/tasks/CreatePermanentTaskScreen.tsx` | Theme tokens |
| `app/screens/tasks/EditPermanentTaskScreen.tsx` | Theme tokens |
| `app/screens/stats/StatsScreen.tsx` | Theme tokens |
| `app/screens/stats/detail/*.tsx` | Theme tokens |
| `app/navigation/MainNavigator.tsx` | Theme tokens |

---

## Implementation Order

1. **`app/theme/tokens.ts` + `ThemeContext.tsx`** — foundation, no UI change yet
2. **`App.tsx`** — wrap with ThemeProvider
3. **`task.ts`** — add `categoryColor` field
4. **`taskStorage.ts`** — JOIN + map `categoryColor`
5. **`permanentTaskActions.ts`** — JOIN + map `categoryColor` on templates
6. **`TaskItem.tsx`** — strip + checkbox colours + overdue + completed dimming (biggest single change)
7. **`UsePermanentTaskScreen.tsx`** — template strip + remove debug bg
8. **All other screens** — swap hardcoded colours to theme tokens (mechanical, low risk)
9. **Test in simulator** — toggle system dark mode, verify all screens

---

## Design Decisions / Open Questions

| Question | Proposed Answer |
|----------|----------------|
| Should the colour strip appear on completed tasks? | Yes — keeps layout stable; opacity dimming on the whole card handles the "done" signal |
| Recurring badge next to title — include? | Start without; add later if it looks cluttered to distinguish only by checkbox colour |
| Should permanent task templates show a category strip? | Yes — templates in UsePermanentTaskScreen are the primary place users associate recurring tasks with categories |
| Dark mode: keep brand header colours (blue/green/orange/purple)? | Yes — they are brand-identity colours, not semantic surfaces |
| `useColorScheme()` — follow system setting only, or allow manual override? | Follow system only for now; user toggle is a future feature |
