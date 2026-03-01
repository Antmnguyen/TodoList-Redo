// app/components/tasks/TaskItem.tsx
// =============================================================================
// TASK ITEM COMPONENT
// =============================================================================
//
// Single task card with three interaction zones:
//   1. Checkbox (left)    → Toggle completion
//   2. Task body (center) → Edit task (opens modal)
//   3. Delete button (right) → Delete task
//
// VISUAL IDENTITY STRIPS
// ----------------------
// Two thin vertical strips sit flush against the left edge of every card,
// conveying two independent pieces of information at a glance:
//
//   ┌─────────────────────────────────────────┐
//   │ ▌▌ [✓] Task title          [due date] ✕ │
//   └─────────────────────────────────────────┘
//    ││
//    │└─ Permanent strip (4 px)
//    │     • theme.accentPermanent (purple)  if task.kind === 'permanent'
//    │     • transparent                     if task is a one-off
//    │
//    └── Category strip (5 px) — leftmost, flush to card edge
//          • Category colour   if task has a category
//          • theme.categoryStripNone (grey)   otherwise
//
// The permanent strip always occupies its 3 px slot; it is just transparent
// for one-off tasks so the card width never shifts.
//
// DATA REQUIREMENT
// ----------------
// task.categoryColor must be populated at load time by taskStorage.getAllTasks()
// via a LEFT JOIN on the categories table.  If it is absent (no category, or
// the category has no colour), the category strip falls back to
// theme.categoryStripNone.
//
// =============================================================================

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Task } from '../../core/types/task';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

type TaskItemProps = {
  task:     Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?:  (task: Task) => void; // Optional: opens edit modal on tap
};

// =============================================================================
// COMPONENT
// =============================================================================

export const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onDelete, onEdit }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // --------------------------------------------------------------------------
  // Checkbox colour — purple for permanent tasks, blue for one-off.
  // This gives a second visual signal beyond the permanent strip, useful
  // when checking the task off without looking at the left edge.
  // --------------------------------------------------------------------------
  const checkboxColor = task.kind === 'permanent'
    ? theme.checkboxBorderPermanent
    : theme.checkboxBorderOneOff;

  // --------------------------------------------------------------------------
  // Permanent strip colour — purple if permanent, transparent if one-off.
  // Using 'transparent' (not theme.bgCard) so it works correctly if the card
  // background ever changes (e.g. highlighted state, dark mode variants).
  // --------------------------------------------------------------------------
  const permanentStripColor = task.kind === 'permanent'
    ? theme.accentPermanent
    : 'transparent';

  // --------------------------------------------------------------------------
  // Category strip colour — use the denormalised colour from the DB JOIN,
  // falling back to the neutral grey defined in the theme.
  // --------------------------------------------------------------------------
  const categoryStripColor = task.categoryColor ?? theme.categoryStripNone;

  return (
    // Outer container: no left padding so strips can sit flush to the edge.
    // paddingRight and paddingVertical preserve the original 16 px spacing
    // for the content area on the other three sides.
    <View style={[styles.container, task.completed && styles.containerCompleted]}>

      {/* ------------------------------------------------------------------
          CATEGORY COLOUR STRIP (5 px)
          Leftmost strip — shows the category's brand colour, or neutral grey
          if uncategorised. borderTopLeftRadius + borderBottomLeftRadius match
          the card's own borderRadius so the strip appears naturally clipped.
         ------------------------------------------------------------------ */}
      <View style={[styles.categoryStrip, { backgroundColor: categoryStripColor }]} />

      {/* ------------------------------------------------------------------
          PERMANENT INDICATOR STRIP (4 px)
          Sits immediately to the right of the category strip.
          Always rendered; transparent for one-off tasks so card width is
          stable regardless of task kind.
          marginRight creates the gap between the strips and the checkbox.
         ------------------------------------------------------------------ */}
      <View style={[styles.permanentStrip, { backgroundColor: permanentStripColor }]} />

      {/* ------------------------------------------------------------------
          CHECKBOX — tap to toggle completion
         ------------------------------------------------------------------ */}
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onToggle(task.id)}
      >
        <View style={[
          styles.checkboxInner,
          { borderColor: checkboxColor },
          // Fill the circle with the checkbox colour when the task is done
          task.completed && { backgroundColor: checkboxColor },
        ]}>
          {task.completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>

      {/* ------------------------------------------------------------------
          TASK BODY — tap to open edit modal
         ------------------------------------------------------------------ */}
      <TouchableOpacity
        style={styles.body}
        onPress={() => onEdit?.(task)}
        activeOpacity={onEdit ? 0.7 : 1}
      >
        <Text style={[
          styles.title,
          task.completed && styles.titleCompleted,
        ]}>
          {task.title}
        </Text>

        {/* Show formatted due date if one is set */}
        {task.dueDate && (
          <Text style={[
            styles.dueDate,
            task.completed && styles.dueDateCompleted,
          ]}>
            {formatDueDate(task.dueDate)}
          </Text>
        )}
      </TouchableOpacity>

      {/* ------------------------------------------------------------------
          DELETE BUTTON
         ------------------------------------------------------------------ */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(task.id)}
      >
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * formatDueDate
 * Returns a human-readable label for a task's due date.
 * "Today" / "Tomorrow" are used for the nearest two days; "Overdue: …"
 * for past dates; otherwise a short "Mon d" string.
 */
function formatDueDate(date: Date): string {
  const today    = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Strip time component for accurate day comparison
  const dateOnly     = new Date(date.getFullYear(),     date.getMonth(),     date.getDate());
  const todayOnly    = new Date(today.getFullYear(),    today.getMonth(),    today.getDate());
  const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

  if (dateOnly.getTime() === todayOnly.getTime())    return 'Today';
  if (dateOnly.getTime() === tomorrowOnly.getTime()) return 'Tomorrow';
  if (dateOnly < todayOnly) {
    return `Overdue: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({

    // ── Card wrapper ────────────────────────────────────────────────────────
    container: {
      flexDirection:  'row',
      // alignItems: 'stretch' lets the strip Views fill the card height via
      // alignSelf: 'stretch' (overriding the default 'center').
      alignItems:     'stretch',
      // No paddingLeft — strips must sit flush against the left edge.
      // paddingRight and paddingVertical keep the original 16 px spacing
      // on all other sides.
      paddingRight:   16,
      paddingVertical: 0, // vertical rhythm is handled by checkbox/body min-height
      backgroundColor: theme.bgCard,
      borderRadius:    8,
      marginBottom:    8,
      shadowColor:     '#000',
      shadowOffset:    { width: 0, height: 1 },
      shadowOpacity:   0.1,
      shadowRadius:    2,
      elevation:       2,
      // NOTE: overflow: 'hidden' is intentionally omitted.
      // Using it would clip the drop shadow on iOS.
      // Instead, the strips use borderTopLeftRadius / borderBottomLeftRadius
      // to match the card corner, giving the same visual result.
      overflow:        'hidden',
    },
    // Dim the entire card when completed — works in both light and dark mode
    // without needing a separate theme override.
    containerCompleted: {
      opacity: 0.6,
    },

    // ── Left-edge identity strips ────────────────────────────────────────────
    // Both strips use alignSelf: 'stretch' so they grow to the full card
    // height regardless of how tall the content area is.

    categoryStrip: {
      // 5 px wide — leftmost strip, the primary category colour signal.
      // Rounded left corners follow the card's own borderRadius: 8.
      width:                  7,
      alignSelf:              'stretch',
      borderTopLeftRadius:    8,
      borderBottomLeftRadius: 8,
    },
    permanentStrip: {
      // 4 px wide — sits to the right of the category strip.
      // No border radius — the category strip covers the card corner.
      // marginRight creates the gap between the strips and the checkbox.
      width:       7,
      alignSelf:   'stretch',
      marginRight: 12,
    },

    // ── Checkbox ────────────────────────────────────────────────────────────
    checkbox: {
      // Vertical centering for the circular checkbox within the card.
      justifyContent: 'center',
      paddingVertical: 16, // matches original padding so tap target stays generous
      marginRight:     12,
    },
    checkboxInner: {
      width:          24,
      height:         24,
      borderRadius:   12,  // circle
      borderWidth:    2,
      alignItems:     'center',
      justifyContent: 'center',
    },
    checkmark: {
      color:      '#fff',
      fontSize:   14,
      fontWeight: 'bold',
    },

    // ── Task body ────────────────────────────────────────────────────────────
    body: {
      flex:           1,
      justifyContent: 'center',
      paddingVertical: 16, // mirrors original container padding on top/bottom
    },
    title: {
      fontSize: 16,
      color:    theme.textPrimary,
    },
    titleCompleted: {
      textDecorationLine: 'line-through',
      color:              theme.completedText,
    },
    dueDate: {
      fontSize:   12,
      color:      theme.textSecondary,
      marginTop:  4,
    },
    dueDateCompleted: {
      color: theme.completedText,
    },

    // ── Delete button ────────────────────────────────────────────────────────
    deleteButton: {
      justifyContent: 'center',
      padding:        4,
      marginLeft:     8,
    },
    deleteText: {
      fontSize: 20,
      color:    theme.danger,
    },
  });
}
