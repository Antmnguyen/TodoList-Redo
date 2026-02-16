// app/navigation/MainNavigator.tsx
// =============================================================================
// MAIN NAVIGATOR
// =============================================================================
//
// Root navigator that manages:
//   - Bottom tab bar navigation
//   - Floating Action Button (shared across tabs)
//   - Create screen navigation (CreateTask, CreatePermanentTask, UsePermanentTask)
//
// The FAB is rendered here once and shared across tabs that need it.
// This avoids duplicating stack navigation logic in each tab.
//
// =============================================================================

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';

// Navigation Components
import { TabBar, Tab } from '../components/navigation/TabBar';

// Screens - Main tab screens
import { AllTasksScreen } from '../screens/tasks/AllTasksScreen';
import { TodayScreen } from '../screens/today/TodayScreen';
import { StatsScreen } from '../screens/stats/StatsScreen';
import { BrowseScreen } from '../screens/browse/BrowseScreen';

// Screens - Create screens (shared across tabs)
import { CreateTaskScreen, CreateTaskFormData } from '../screens/tasks/CreateTaskScreen';
import { CreatePermanentTaskScreen, PermanentTaskFormData } from '../screens/tasks/CreatePermanentTaskScreen';
import { UsePermanentTaskScreen } from '../screens/tasks/UsePermanentTaskScreen';

// Components
import { FloatingCreateTaskButton } from '../components/tasks/FloatingCreateTaskButton';

// Actions
import { createTask } from '../core/domain/taskActions';
import { Task } from '../core/types/task';

// =============================================================================
// TYPES
// =============================================================================

type TabKey = 'tasks' | 'today' | 'stats' | 'browse';
type OverlayScreen = 'none' | 'CreateTask' | 'CreatePermanentTask' | 'UsePermanentTask';

// =============================================================================
// TAB CONFIGURATION
// =============================================================================

const TABS: Tab[] = [
  { key: 'tasks', label: 'All Tasks', icon: '📋' },
  { key: 'today', label: 'Today', icon: '📅' },
  { key: 'stats', label: 'Stats', icon: '📊' },
  { key: 'browse', label: 'Browse', icon: '🔍' },
];

// Tabs that show the FAB
const TABS_WITH_FAB: TabKey[] = ['tasks', 'today'];

// FAB colors per tab
const FAB_COLORS: Record<TabKey, string> = {
  tasks: '#007AFF',  // Blue
  today: '#34C759',  // Green
  stats: '#FF9500',  // Orange (if FAB added later)
  browse: '#5856D6', // Purple (if FAB added later)
};

// =============================================================================
// COMPONENT
// =============================================================================

export const MainNavigator: React.FC = () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabKey>('tasks');
  const [overlayScreen, setOverlayScreen] = useState<OverlayScreen>('none');
  const [refreshKey, setRefreshKey] = useState(0);

  // ---------------------------------------------------------------------------
  // FAB Handlers
  // ---------------------------------------------------------------------------
  const handleCreateTask = () => setOverlayScreen('CreateTask');
  const handleUsePermanentTask = () => setOverlayScreen('UsePermanentTask');
  const handleCreatePermanentTask = () => setOverlayScreen('CreatePermanentTask');

  const goBack = () => setOverlayScreen('none');

  // ---------------------------------------------------------------------------
  // Create Screen Callbacks
  // ---------------------------------------------------------------------------

  // Called when a task is created via CreateTaskScreen
  // Location of createTask: app/core/domain/taskActions.ts
  // Location of saveTask: app/core/services/storage/taskStorage.ts
  const handleCreateTaskSave = async (data: CreateTaskFormData) => {
    await createTask(data.title, 'one_off', {
      dueDate: data.dueDate,
      category: data.category,
    });
    setRefreshKey(prev => prev + 1);
    goBack();
  };

  // Called when permanent task template is saved
  const handlePermanentTaskSave = (data: PermanentTaskFormData) => {
    console.log('Permanent task template saved:', data);
    setRefreshKey(prev => prev + 1);
    goBack();
  };

  // Called when permanent task instance is created
  const handleInstanceCreated = (task: Task) => {
    console.log('Permanent task instance created:', task);
    setRefreshKey(prev => prev + 1);
    goBack();
  };

  // ---------------------------------------------------------------------------
  // Render Tab Content
  // ---------------------------------------------------------------------------
  const renderTabContent = () => {
    switch (activeTab) {
      case 'tasks':
        return <AllTasksScreen key={`tasks-${refreshKey}`} />;
      case 'today':
        return <TodayScreen key={`today-${refreshKey}`} />;
      case 'stats':
        return <StatsScreen />;
      case 'browse':
        return <BrowseScreen />;
      default:
        return <AllTasksScreen key={`tasks-${refreshKey}`} />;
    }
  };

  // ---------------------------------------------------------------------------
  // Render Overlay Screen (Create screens)
  // ---------------------------------------------------------------------------
  const renderOverlayScreen = () => {
    switch (overlayScreen) {
      case 'CreateTask':
        return (
          <CreateTaskScreen
            onSave={handleCreateTaskSave}
            onCancel={goBack}
          />
        );
      case 'CreatePermanentTask':
        return (
          <CreatePermanentTaskScreen
            onSave={handlePermanentTaskSave}
            onCancel={goBack}
          />
        );
      case 'UsePermanentTask':
        return (
          <UsePermanentTaskScreen
            onInstanceCreated={handleInstanceCreated}
            onCancel={goBack}
          />
        );
      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------
  const showFAB = overlayScreen === 'none' && TABS_WITH_FAB.includes(activeTab);
  const showTabBar = overlayScreen === 'none';
  const fabColor = FAB_COLORS[activeTab];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Content Area */}
      <View style={styles.content}>
        {overlayScreen === 'none' ? renderTabContent() : renderOverlayScreen()}
      </View>

      {/* Floating Action Button - shared across tabs */}
      {showFAB && (
        <FloatingCreateTaskButton
          color={fabColor}
          onCreateTask={handleCreateTask}
          onUsePermanentTask={handleUsePermanentTask}
          onCreatePermanentTask={handleCreatePermanentTask}
        />
      )}

      {/* Bottom Tab Bar - hidden when overlay screen is active */}
      {showTabBar && (
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabPress={(key) => setActiveTab(key as TabKey)}
        />
      )}
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
});
