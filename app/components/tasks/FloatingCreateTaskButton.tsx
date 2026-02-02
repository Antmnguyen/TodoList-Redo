// app/components/tasks/FloatingCreateTaskButton.tsx
// =============================================================================
// FLOATING ACTION BUTTON (FAB) WITH EXPANDABLE MENU
// =============================================================================
//
// This component was updated from a simple single-action FAB to a FAB with
// a popup menu. It remains props-only (no hooks) following the architecture.
//
// CHANGES MADE:
// 1. Changed from circular (borderRadius: 28) to rounded box (borderRadius: 14)
// 2. Added 'color' prop so the FAB color can be customized per screen
// 3. Replaced single 'onPress' prop with three action callbacks:
//    - onCreateTask: opens the create task modal
//    - onUsePermanentTask: opens permanent task selector
//    - onCreatePermanentTask: opens permanent task creator
// 4. Added internal menuVisible state to control the popup menu
// 5. Added Modal component that renders a hovering menu above the FAB
// 6. Menu appears in bottom-right corner (aligned with FAB position)
// 7. Tapping outside the menu (on backdrop) closes it
//
// USAGE:
// <FloatingCreateTaskButton
//   color="#007AFF"
//   onCreateTask={() => setModalVisible(true)}
//   onUsePermanentTask={() => navigation.navigate('SelectPermanentTask')}
//   onCreatePermanentTask={() => navigation.navigate('CreatePermanentTask')}
// />
// =============================================================================

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Modal,
  Pressable,
} from 'react-native';

export type FloatingCreateTaskButtonProps = {
  /** Background color of the FAB - can be changed per screen */
  color?: string;
  /** Called when "Create task" is selected from menu */
  onCreateTask: () => void;
  /** Called when "Use permanent task" is selected from menu */
  onUsePermanentTask: () => void;
  /** Called when "Create permanent task" is selected from menu */
  onCreatePermanentTask: () => void;
};

export const FloatingCreateTaskButton: React.FC<FloatingCreateTaskButtonProps> = ({
  color = '#007AFF',
  onCreateTask,
  onUsePermanentTask,
  onCreatePermanentTask,
}) => {
  // Local state to control menu visibility - this is UI state, not data state,
  // so it's acceptable in a presentational component
  const [menuVisible, setMenuVisible] = useState(false);

  // Helper to close menu and trigger the selected action
  const handleOptionPress = (action: () => void) => {
    setMenuVisible(false);
    action();
  };

  return (
    <>
      {/* THE FAB BUTTON - positioned absolute in bottom-right corner */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: color }]}
        onPress={() => setMenuVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.icon}>+</Text>
      </TouchableOpacity>

      {/* THE POPUP MENU - renders as a Modal overlay on top of current screen */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        {/* Backdrop - tapping outside menu closes it */}
        <Pressable style={styles.backdrop} onPress={() => setMenuVisible(false)}>
          {/* Menu container - positioned bottom-right above the FAB */}
          <View style={styles.menuContainer}>
            {/* Option 1: Create a new one-off task */}
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemFirst]}
              onPress={() => handleOptionPress(onCreateTask)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemLabel}>Create task</Text>
            </TouchableOpacity>

            {/* Option 2: Use an existing permanent task template */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleOptionPress(onUsePermanentTask)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemLabel}>Use permanent task</Text>
            </TouchableOpacity>

            {/* Option 3: Create a new permanent task template */}
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => handleOptionPress(onCreatePermanentTask)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemLabel}>Create permanent task</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

// =============================================================================
// STYLES
// =============================================================================
const styles = StyleSheet.create({
  // FAB button styles - rounded box positioned in bottom-right corner
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 14, // Changed from 28 (circle) to 14 (rounded box)
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    // Shadow for Android
    elevation: 5,
  },
  // Plus icon inside FAB
  icon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
  // Semi-transparent backdrop that covers the screen when menu is open
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 90, // Positions menu above the FAB
    paddingRight: 24,  // Aligns menu with FAB's right edge
  },
  // White container holding the menu options
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 200,
    // Elevated shadow for the floating menu
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  // Individual menu item row
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  // First menu item gets top rounded corners
  menuItemFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  // Last menu item gets bottom rounded corners, no border
  menuItemLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  // Menu item text
  menuItemLabel: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
});
