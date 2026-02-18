# Sprint 5 Plan: Polish & Usability

**Status:** Planning
**Goal:** Professional UI overhaul and quality-of-life improvements

---

## Overview

This sprint focuses on making the app look and feel professional without changing core logic. The frontend-to-backend data flow remains the same — we're only improving visuals, animations, and usability.

---

## Part 1: UI Polish & Theming

### 1.1 Design System Overhaul

**Goal:** Consistent, professional look across all screens

#### Color Scheme Options

**Option A: Dark Mode (Recommended)**
```
Background:     #121212 (near black)
Surface:        #1E1E1E (cards, modals)
Primary:        #BB86FC (purple accent)
Secondary:      #03DAC6 (teal accent)
Text Primary:   #FFFFFF
Text Secondary: #B3B3B3
Success:        #4CAF50
Error:          #CF6679
```

**Option B: Modern Light**
```
Background:     #F5F5F7 (apple gray)
Surface:        #FFFFFF
Primary:        #007AFF (iOS blue)
Secondary:      #5856D6 (purple)
Text Primary:   #1C1C1E
Text Secondary: #8E8E93
```

**Option C: Neutral Dark**
```
Background:     #0D1117 (GitHub dark)
Surface:        #161B22
Primary:        #58A6FF
Accent:         #F78166
Text:           #C9D1D9
```

#### Implementation

- [ ] Create `theme.ts` with color tokens
- [ ] Create `ThemeContext` for app-wide theming
- [ ] Consider `useColorScheme()` for system dark mode detection
- [ ] Apply theme to all components

---

### 1.2 Typography & Spacing

**Font Recommendations:**
- System default (San Francisco on iOS, Roboto on Android)
- Or consider: Inter, Poppins, or SF Pro (if licensed)

**Spacing Scale:**
```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

**Typography Scale:**
```typescript
const typography = {
  h1: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
};
```

---

### 1.3 Component Styling Upgrades

| Component | Current | Improved |
|-----------|---------|----------|
| TaskItem | Basic card | Subtle shadow, rounded corners, swipe actions |
| TabBar | Flat | Blur effect, subtle shadow, pill indicator |
| FAB | Square-ish | Perfect circle or pill with shadow |
| Headers | Solid color | Gradient or blur |
| Cards | Plain white | Neumorphism or glass effect |
| Buttons | Basic | Haptic feedback, press states |

---

### 1.4 Libraries to Consider

| Library | Purpose | Notes |
|---------|---------|-------|
| `react-native-reanimated` | Smooth animations | Already common, performant |
| `react-native-gesture-handler` | Swipe gestures | For task actions |
| `@shopify/flash-list` | Fast lists | Better than FlatList |
| `react-native-linear-gradient` | Gradients | Header backgrounds |
| `expo-blur` | Blur effects | Tab bar, modals |
| `expo-haptics` | Haptic feedback | Button presses |
| `react-native-svg` | Icons & graphics | Custom icons |

---

## Part 2: Usability Improvements

### 2.1 Completed Tasks Auto-Hide

**Behavior:** Completed tasks in "All Tasks" vanish after a set time (end of day or 24 hours)

**Options:**
- A) Hide at midnight (next day they're gone from main list)
- B) Hide after 24 hours from completion
- C) Move to "Completed" section that collapses

**Implementation:**
```typescript
// Filter completed tasks older than X hours
const visibleTasks = tasks.filter(task => {
  if (!task.completed) return true;
  if (!task.completedAt) return true;

  const hoursSinceCompletion = (Date.now() - task.completedAt) / (1000 * 60 * 60);
  return hoursSinceCompletion < 24; // Hide after 24 hours
});
```

**Tasks:**
- [ ] Add filter logic to AllTasksScreen
- [ ] Consider "Show Completed" toggle
- [ ] Completed tasks still visible in Stats/Browse

---

### 2.2 Permanent Task Template Management

**Moved from Sprint 3:** Tasks 3.4 (Edit) and 3.5 (Delete)

**Location:** UsePermanentTaskScreen or new section in Browse

**Features:**
- View all templates
- Edit template (name, repeatability settings)
- Delete template (with confirmation)
- View template stats

**UI:**
```
┌─────────────────────────────────────────┐
│  Morning Workout            ⋮  (menu)  │
│  Auto-repeat: Daily                     │
│  Used 45 times                          │
└─────────────────────────────────────────┘
        │
        └── Menu Options:
              • Edit Template
              • View Stats
              • Delete Template
```

**Tasks:**
- [ ] Add edit/delete menu to template list items
- [ ] Create EditPermanentTaskScreen (or modal)
- [ ] Add delete confirmation dialog
- [ ] Update storage functions

---

### 2.3 Browse Screen Features (TBA)

**Potential Features:**
- [ ] Search tasks by title
- [ ] Filter by category
- [ ] Filter by date range
- [ ] Filter by completion status
- [ ] Sort options (date, name, category)

**Placeholder for now — details TBD**

---

### 2.4 Task Archival System

**Goal:** Automatically sweep completed tasks out of the main task list into a lightweight archive, and surface that history in Browse.

**How it differs from 2.1 (auto-hide):**
- 2.1 just filters the UI — data stays in `tasks`
- 2.4 physically removes the row from `tasks` and writes a compressed record to a separate `task_archive` table

---

#### Archive Data Format

Archived records store only what's needed for history — full task objects are not kept:

```typescript
interface ArchivedTask {
  id: string;           // original task id
  title: string;        // task name
  categoryId?: string;  // for grouping in history
  categoryName?: string; // denormalized — category may be deleted later
  completedAt: number;  // timestamp (ms) — primary sort key
  archivedAt: number;   // when the archival job ran
  wasRecurring: boolean; // true if this was a permanent task instance
}
```

#### Schema

```sql
CREATE TABLE IF NOT EXISTS task_archive (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category_id TEXT,
  category_name TEXT,
  completed_at INTEGER NOT NULL,
  archived_at INTEGER NOT NULL,
  was_recurring INTEGER NOT NULL DEFAULT 0
);
```

#### Archival Rules

- **What gets archived:** all completed tasks — both one-off tasks and permanent task instances. Permanent task instances are still deleted from `tasks` and `template_instances` as before, and `template_stats` still tracks their aggregate stats (streaks, rates, etc.) — but a compressed record is also written to `task_archive` so individual completions appear in Task History. `was_recurring` is set to `true` for these rows.
- **What is preserved:** `id`, `title`, `category_id`, `category_name` (denormalized snapshot), `completed_at`, `was_recurring`
- **What is discarded:** `due_date`, `created_at`, `completed` flag (always true in archive)
- **Trigger:** Automatic archival job runs on a configurable schedule (default: daily, exact interval TBD — options are every X hours or once at midnight)
- **Manual option:** User can also trigger archival from Settings (future)

#### Archival Job

```typescript
// services/archivalService.ts
async function archiveCompletedTasks(): Promise<number> {
  // 1. Fetch all completed one-off tasks from tasks table
  // 2. Write compressed ArchivedTask rows to task_archive
  // 3. Delete the original rows from tasks
  // 4. Return count of archived tasks
}
```

The job runs via a lightweight interval (e.g. `setInterval` on app resume, or a background task via `expo-background-fetch` if available). Exact scheduling TBD.

#### Browse > Task History UI

A new "Task History" entry in the Browse feature list opens a `TaskHistoryScreen`:

```
BrowseScreen
  └── Feature List
        ├── "Categories"     → CategoryManagementScreen  (done, Sprint 3)
        ├── "Task History"   → TaskHistoryScreen          (this feature)
        └── ...

TaskHistoryScreen
  ├── Header: "Task History"
  ├── Time filter bar: [All | Today | This Week | This Month | This Year]
  ├── Grouped list (by day):
  │     ┌─────────────────────────────────┐
  │     │  February 18                    │
  │     │  ✓ Buy groceries    [Work]      │
  │     │  ✓ Morning run      [Health]    │
  │     └─────────────────────────────────┘
  └── Empty state: "No archived tasks yet"
```

---

**Requirements:**
- [ ] `task_archive` table created in schema
- [ ] `archivalService.ts` — `archiveCompletedTasks()` function
- [ ] Archival job scheduled on app start (configurable interval, default daily)
- [ ] Permanent task instances: write compressed record to `task_archive` (wasRecurring: true), then delete from `tasks` as normal — template_stats logic unchanged
- [ ] `TaskHistoryScreen` in Browse with time filter (All / Today / Week / Month / Year)
- [ ] History grouped by day, showing title + category name
- [ ] `BrowseScreen` feature list updated with "Task History" entry

**Files:**
- [ ] `app/core/services/storage/schema/archive.ts` — `task_archive` table
- [ ] `app/core/services/archivalService.ts` — archival logic + scheduling
- [ ] `app/screens/browse/TaskHistoryScreen.tsx` — history UI
- [ ] `app/screens/browse/BrowseScreen.tsx` — add Task History entry
- [ ] `app/core/services/storage/archiveStorage.ts` — read/write archive table

---

## Part 3: Animations

### 3.1 Animation Inventory

| Location | Animation | Type |
|----------|-----------|------|
| Task completion | Checkbox fill + strikethrough | Spring |
| Task deletion | Slide out + fade | Timing |
| Screen transitions | Slide left/right | Native |
| FAB menu | Scale + fade in | Spring |
| Tab switch | Crossfade content | Timing |
| Card appear | Fade in + slide up | Stagger |
| Pull to refresh | Bounce | Spring |
| Modal open | Slide up + backdrop fade | Timing |

### 3.2 Animation Utilities

```typescript
// utils/animations.ts
import { withSpring, withTiming, FadeIn, SlideInRight } from 'react-native-reanimated';

export const springConfig = {
  damping: 15,
  stiffness: 150,
};

export const timingConfig = {
  duration: 200,
};

// Predefined entering animations
export const fadeInUp = FadeIn.duration(300).springify();
export const slideInRight = SlideInRight.duration(250);
```

### 3.3 Tasks

- [ ] Install `react-native-reanimated` (if not present)
- [ ] Add task completion animation
- [ ] Add task deletion animation
- [ ] Add FAB menu animation
- [ ] Add list item stagger animation
- [ ] Add screen transition animations

---

## Part 4: Task List & Checklist

### Completed Tasks Cleanup
- [ ] Implement 24-hour auto-hide for completed tasks (2.1)
- [ ] Add "Show Completed" toggle option
- [ ] Ensure completed tasks remain in database until archival job runs

### Task Archival (2.4)
- [ ] Create `task_archive` schema and migration
- [ ] Implement `archiveCompletedTasks()` in `archivalService.ts`
- [ ] Schedule archival job on app start (daily / configurable)
- [ ] Permanent task instances: archive to `task_archive` (wasRecurring: true), then delete from tasks — all existing template_stats logic unchanged
- [ ] Build `TaskHistoryScreen` with time filter tabs
- [ ] Group history by day, show title + category
- [ ] Add "Task History" entry to BrowseScreen feature list

### Template Management
- [ ] Add menu (⋮) to template items in UsePermanentTaskScreen
- [ ] Create template edit functionality
- [ ] Create template delete with confirmation
- [ ] Update `permanentTaskStorage.ts` with update/delete functions

### Animations
- [ ] Task complete animation
- [ ] Task delete swipe animation
- [ ] FAB expand animation
- [ ] Screen transitions
- [ ] List loading stagger

### Theming
- [ ] Create `theme.ts` with color tokens
- [ ] Create light/dark theme objects
- [ ] Implement ThemeContext
- [ ] Apply to all screens
- [ ] Test on light and dark system modes

### Polish
- [ ] Add haptic feedback to buttons
- [ ] Improve empty states with illustrations
- [ ] Add loading skeletons
- [ ] Improve error states
- [ ] Review all spacing/padding for consistency

---

## File Structure Additions

```
app/
├── theme/
│   ├── theme.ts              # Color tokens, spacing, typography
│   ├── ThemeContext.tsx      # Theme provider
│   └── useTheme.ts           # Theme hook
│
├── utils/
│   └── animations.ts         # Reusable animation configs
│
├── core/
│   └── services/
│       ├── archivalService.ts            # Archival job + scheduling (2.4)
│       └── storage/
│           ├── archiveStorage.ts         # Read/write task_archive table (2.4)
│           └── schema/
│               └── archive.ts            # task_archive schema (2.4)
│
├── screens/
│   └── browse/
│       └── TaskHistoryScreen.tsx         # Browse > Task History (2.4)
│
├── components/
│   ├── ui/
│   │   ├── ThemedText.tsx    # Text with theme colors
│   │   ├── ThemedView.tsx    # View with theme colors
│   │   └── AnimatedCard.tsx  # Card with enter/exit animations
│   │
│   └── feedback/
│       ├── LoadingSkeleton.tsx
│       └── EmptyState.tsx    # Update with better design
```

---

## Priority Order

1. **High:** Task archival system — schema, service, scheduled job (2.4)
2. **High:** Browse > Task History screen (2.4)
3. **High:** Template edit/delete (user need, moved from Sprint 3)
4. **Medium:** Completed tasks auto-hide UI filter (2.1)
5. **Medium:** Basic animations (completion, delete)
6. **Medium:** Theme system setup
7. **Low:** Full dark mode implementation
8. **Low:** Advanced animations
9. **TBD:** Browse search/filter features (2.3)

---

## Success Criteria

- [ ] App looks modern and professional
- [ ] Completed tasks are automatically archived and removed from the main task list
- [ ] Archived tasks are viewable in Browse > Task History, filterable by time range
- [ ] Completed permanent task instances appear in Task History (wasRecurring: true), deleted from tasks table as normal, template_stats unaffected
- [ ] Archive stores only compressed data (title, category, completedAt) — not full task objects
- [ ] Users can manage permanent task templates
- [ ] Animations feel smooth and purposeful
- [ ] Consistent spacing and typography
- [ ] Works well in both light and dark modes
- [ ] No regression in existing functionality

---

## Notes

- Keep logic the same — only change presentation
- Test animations on low-end devices
- Consider accessibility (motion reduce preference)
- Dark mode can be Phase 2 if time-constrained

---
---

# ============================================================
# SUGGESTIONS & BACKLOG
# ============================================================
# Everything below this line is NOT part of Sprint 5.
# These are ideas, suggestions, and future considerations.
# Move items up to the sprint plan if/when they become priority.
# ============================================================

---

## SUGGESTED: Additional Features to Consider

### Task Interactions
- [ ] Swipe actions (swipe right = complete, swipe left = delete/snooze)
- [ ] Long-press context menu (edit, delete, change date, move category)
- [ ] Drag-and-drop task reordering
- [ ] Bulk selection mode (select multiple → delete/complete all)
- [ ] Undo delete (toast with "Undo" button, 5 second window)
- [ ] Pin important tasks to top

### Task Details Enhancements
- [ ] Task notes/description field
- [ ] Due time support (not just date)
- [ ] Priority levels (low, medium, high) with visual indicators
- [ ] Subtasks/checklist within a task

### Navigation & UX
- [ ] Pull-to-refresh on all list screens
- [ ] Scroll-to-top on tab re-tap
- [ ] "Recently Deleted" trash (recover within 30 days)
- [ ] Search history in Browse
- [ ] Keyboard shortcuts (tablet support)

### Settings Screen
- [ ] Create Settings screen (accessible from header or tab)
- [ ] Theme selection (light/dark/system)
- [ ] Default due date preference
- [ ] Notification preferences
- [ ] Auto-hide completed tasks toggle + duration
- [ ] Data export (JSON/CSV)
- [ ] Reset/clear all data option

### Onboarding
- [ ] First-launch onboarding slides
- [ ] Feature tooltips for new users
- [ ] Sample tasks on first install

### Accessibility
- [ ] Screen reader labels on all interactive elements
- [ ] Respect system "reduce motion" setting
- [ ] Minimum touch target sizes (44x44)
- [ ] High contrast mode support
- [ ] Dynamic font size support

---

## SUGGESTED: Feature Priority Matrix

### High Value / Low Effort (Do First)

| Feature | Value | Effort | Notes |
|---------|-------|--------|-------|
| Undo delete | High | Low | Prevents accidents, toast + timeout |
| Pull-to-refresh | Medium | Low | Already have refresh logic |
| Haptic feedback | Medium | Low | One line per button |
| Swipe to complete | High | Medium | Expected UX pattern |

### High Value / Medium Effort

| Feature | Value | Effort | Notes |
|---------|-------|--------|-------|
| Swipe actions | High | Medium | Industry standard |
| Settings screen | High | Medium | Users expect this |
| Task notes | Medium | Low | Simple text field |

### High Value / High Effort (Future)

| Feature | Value | Effort | Notes |
|---------|-------|--------|-------|
| Notifications/reminders | High | High | Push notification setup |
| Widget support | High | High | Platform-specific |
| Cloud sync | High | Very High | Backend needed |
| Calendar view | Medium | High | Complex rendering |

---

## SUGGESTED: Future Sprint Ideas

| Feature | Description |
|---------|-------------|
| Share tasks | Send task to another user |
| Collaboration | Shared task lists with others |
| Voice input | "Add task: buy milk" |
| AI suggestions | Smart due date/category suggestions |
| Integrations | Google Calendar, Apple Reminders sync |
| Advanced recurring | "Every 2nd Tuesday", "Weekdays only" |
| Location reminders | Remind when arriving/leaving location |
| Focus mode | Hide everything except today's tasks |
| Quick templates | One-tap add common tasks |
| Gamification | Points, badges, streaks, levels |

---

## SUGGESTED: Quick Wins

These can be done in a few hours each:

1. **Undo delete toast** - Show toast with undo button for 5 seconds
2. **Pull-to-refresh** - Already have refresh logic, just add gesture
3. **Empty state illustrations** - Replace text with friendly graphics
4. **Haptic feedback** - `Haptics.impactAsync()` on buttons
5. **Loading skeletons** - Better perceived performance than spinners
6. **Scroll to top** - On tab re-tap

---

## SUGGESTED: Technical Debt

- [ ] Remove deprecated TasksStack.tsx and TodayStack.tsx files
- [ ] Consolidate duplicate styles into theme system
- [ ] Add TypeScript strict mode
- [ ] Add error boundaries for crash handling
- [ ] Add unit tests for utility functions
- [ ] Add integration tests for storage layer
- [ ] Performance profiling on list screens
- [ ] Memory leak audit (useEffect cleanup)
- [ ] Audit and remove unused dependencies
