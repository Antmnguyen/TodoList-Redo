# Architecture Guide

**Last Updated:** February 15, 2026

This guide explains the app's architecture and how to work with it.

---

## Navigation Architecture

### Overview

All navigation is centralized in `MainNavigator.tsx`. This component manages:
- Bottom tab bar
- Floating Action Button (FAB)
- Overlay screens (create screens)
- Screen refresh logic

```
App.tsx
  └── MainNavigator (app/navigation/MainNavigator.tsx)
        │
        ├── Content Area (renders active screen)
        │     ├── AllTasksScreen
        │     ├── TodayScreen
        │     ├── StatsScreen
        │     ├── BrowseScreen
        │     └── Overlay Screens (CreateTask, etc.)
        │
        ├── FloatingCreateTaskButton (shared)
        │
        └── TabBar (bottom navigation)
```

### Key Files

| File | Purpose |
|------|---------|
| `app/navigation/MainNavigator.tsx` | Central navigation logic |
| `app/components/navigation/TabBar.tsx` | Reusable tab bar component |
| `app/components/tasks/FloatingCreateTaskButton.tsx` | FAB with popup menu |

---

## How to Add a New Tab

### Step 1: Create the Screen

Create a new screen in `app/screens/`:

```typescript
// app/screens/example/ExampleScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export const ExampleScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Example</Text>
        <Text style={styles.subtitle}>Subtitle here</Text>
      </View>
      {/* Content */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#YOUR_COLOR', // Pick a color
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#fff', opacity: 0.8 },
});
```

### Step 2: Update MainNavigator

**File:** `app/navigation/MainNavigator.tsx`

1. Import the screen:
```typescript
import { ExampleScreen } from '../screens/example/ExampleScreen';
```

2. Add to TabKey type:
```typescript
type TabKey = 'tasks' | 'today' | 'stats' | 'browse' | 'example';
```

3. Add to TABS array:
```typescript
const TABS: Tab[] = [
  { key: 'tasks', label: 'All Tasks', icon: '📋' },
  { key: 'today', label: 'Today', icon: '📅' },
  { key: 'stats', label: 'Stats', icon: '📊' },
  { key: 'browse', label: 'Browse', icon: '🔍' },
  { key: 'example', label: 'Example', icon: '⭐' }, // NEW
];
```

4. Add to renderTabContent():
```typescript
case 'example':
  return <ExampleScreen />;
```

5. (Optional) Add FAB to tab:
```typescript
const TABS_WITH_FAB: TabKey[] = ['tasks', 'today', 'example'];
```

6. (Optional) Set FAB color:
```typescript
const FAB_COLORS: Record<TabKey, string> = {
  // ...existing
  example: '#FF6B6B', // Your color
};
```

---

## How to Add a New Create/Overlay Screen

Overlay screens replace the tab content temporarily (like CreateTaskScreen).

### Step 1: Create the Screen

```typescript
// app/screens/example/CreateExampleScreen.tsx
interface CreateExampleScreenProps {
  onSave: (data: YourDataType) => void;
  onCancel: () => void;
}

export const CreateExampleScreen: React.FC<CreateExampleScreenProps> = ({
  onSave,
  onCancel,
}) => {
  // Your form UI
};
```

### Step 2: Update MainNavigator

1. Import:
```typescript
import { CreateExampleScreen } from '../screens/example/CreateExampleScreen';
```

2. Add to OverlayScreen type:
```typescript
type OverlayScreen = 'none' | 'CreateTask' | ... | 'CreateExample';
```

3. Add handler:
```typescript
const handleCreateExample = () => setOverlayScreen('CreateExample');
```

4. Add to renderOverlayScreen():
```typescript
case 'CreateExample':
  return (
    <CreateExampleScreen
      onSave={handleExampleSave}
      onCancel={goBack}
    />
  );
```

5. Add save handler:
```typescript
const handleExampleSave = async (data: YourDataType) => {
  // Save logic
  setRefreshKey(prev => prev + 1);
  goBack();
};
```

---

## Data Flow Architecture

### Creating a Task

```
UI Layer                    Domain Layer              Storage Layer
─────────                   ────────────              ─────────────
CreateTaskScreen
  │
  └─→ onSave(formData)
        │
        └─→ MainNavigator.handleCreateTaskSave()
              │
              └─→ createTask()              (app/core/domain/taskActions.ts)
                    │
                    └─→ TaskFactory.create() (app/core/types/task.ts)
                          │
                          └─→ saveTask()    (app/core/services/storage/taskStorage.ts)
                                │
                                └─→ SQLite INSERT
```

### Loading Tasks

```
Screen                      Hook                      Storage
──────                      ────                      ───────
AllTasksScreen
  │
  └─→ useTasks()            (app/core/hooks/useTasks.ts)
        │
        └─→ getAllTasks()   (app/core/services/storage/taskStorage.ts)
              │
              └─→ SQLite SELECT
                    │
                    └─→ tasks state
                          │
                          └─→ sortTasksByCompletion()
                                │
                                └─→ TaskList renders
```

---

## Utilities

### Task Sorting
**File:** `app/core/utils/taskSorting.ts`

```typescript
import { sortTasksByCompletion } from '../../core/utils/taskSorting';

// Uncompleted first, completed last
const sorted = sortTasksByCompletion(tasks);

// With date sorting within groups
const sorted = sortTasksByCompletionAndDate(tasks);
```

### Task Filtering
**File:** `app/core/utils/taskFilters.ts`

```typescript
import {
  filterTasksDueToday,
  filterTasksDueTomorrow,
  filterTasksOverdue,
  filterTasksWithNoDueDate
} from '../../core/utils/taskFilters';

const todayTasks = filterTasksDueToday(tasks);
const overdue = filterTasksOverdue(tasks);
```

---

## Color Scheme

| Screen | Header Color | Usage |
|--------|--------------|-------|
| All Tasks | `#007AFF` (Blue) | Primary task list |
| Today | `#34C759` (Green) | Today's tasks |
| Stats | `#FF9500` (Orange) | Statistics |
| Browse | `#5856D6` (Purple) | Search/filter |

---

## Component Patterns

### Screen with Header + List

```typescript
export const MyScreen: React.FC = () => {
  const { tasks, toggleTask, removeTask } = useTasks();

  const filteredTasks = useMemo(() => /* filter logic */, [tasks]);
  const sortedTasks = useMemo(() => sortTasksByCompletion(filteredTasks), [filteredTasks]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Title</Text>
        <Text style={styles.subtitle}>{count} items</Text>
      </View>
      <TaskList
        tasks={sortedTasks}
        onToggle={toggleTask}
        onDelete={removeTask}
        emptyMessage="No tasks"
      />
    </SafeAreaView>
  );
};
```

---

## File Structure

```
app/
├── components/
│   ├── navigation/
│   │   └── TabBar.tsx           # Bottom tab bar
│   ├── tasks/
│   │   ├── TaskList.tsx         # Task list component
│   │   ├── TaskItem.tsx         # Single task row
│   │   └── FloatingCreateTaskButton.tsx
│   └── ui/                      # Generic UI components
│
├── core/
│   ├── domain/
│   │   └── taskActions.ts       # Business logic
│   ├── hooks/
│   │   └── useTasks.ts          # Task data hook
│   ├── services/storage/
│   │   ├── taskStorage.ts       # SQLite operations
│   │   └── schema/              # Table definitions
│   ├── types/
│   │   └── task.ts              # Type definitions
│   └── utils/
│       ├── taskSorting.ts       # Sort utilities
│       └── taskFilters.ts       # Filter utilities
│
├── navigation/
│   └── MainNavigator.tsx        # Central navigation
│
└── screens/
    ├── tasks/
    │   ├── AllTasksScreen.tsx
    │   ├── CreateTaskScreen.tsx
    │   └── ...
    ├── today/
    │   └── TodayScreen.tsx
    ├── stats/
    │   └── StatsScreen.tsx
    └── browse/
        └── BrowseScreen.tsx
```

---

## Best Practices

1. **Don't duplicate navigation logic** - All navigation goes through MainNavigator
2. **Use utilities** - Sort/filter functions are in `core/utils/`
3. **Screens are display-only** - Business logic lives in domain/actions
4. **Memoize expensive operations** - Use `useMemo` for filtering/sorting
5. **Follow color scheme** - Each tab has a designated color
6. **Props over state** - Screens receive callbacks, don't manage navigation state
