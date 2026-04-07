// app/screens/browse/HealthManagementScreen.tsx
// =============================================================================
// HEALTH MANAGEMENT SCREEN — Hub
// =============================================================================
//
// Entry point for the Health Connect feature. Shows:
//   - Connection status badge (Available / Not Installed / Unknown)
//   - Three tappable section rows (Steps, Sleep, Workouts)
//   - Sync Now button + last-synced timestamp
//
// Navigation model: same local sub-screen pattern used by BrowseScreen.
//   subScreen === 'none'     → this hub
//   subScreen === 'steps'    → StepsDetailScreen    (Phase 3b)
//   subScreen === 'sleep'    → SleepDetailScreen    (Phase 3c)
//   subScreen === 'workouts' → WorkoutsDetailScreen (Phase 3d)
//
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

import {
  checkStatus,
  sync,
} from '../../features/googleFit/utils/healthConnectActions';
import {
  getLastSyncedAt,
  getStepsGoal,
  getSleepGoal,
} from '../../core/services/storage/healthConnectStorage';
import { toLocalDateString } from '../../core/utils/statsCalculations';
import { getStepsInRange, getSleepInRange } from '../../core/services/storage/healthConnectStorage';
import { HealthConnectStatus } from '../../features/googleFit/types/healthConnect';

// =============================================================================
// TYPES
// =============================================================================

export interface HealthManagementScreenProps {
  onBack: () => void;
}

type SubScreen = 'none' | 'steps' | 'sleep' | 'workouts';

// Brand colour — identity colour, same in light + dark
const HC_COLOR = '#33ace5';

// =============================================================================
// HELPERS
// =============================================================================

/** Format an ISO timestamp into a human-readable "X min ago" string. */
function formatLastSynced(iso: string | null): string {
  if (!iso) return 'Never synced';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusLabel(status: HealthConnectStatus): string {
  switch (status) {
    case HealthConnectStatus.Available:    return 'Connected';
    case HealthConnectStatus.NotInstalled: return 'Not Installed';
    case HealthConnectStatus.NotSupported: return 'Not Supported';
    default:                               return 'Unknown';
  }
}

function statusColor(status: HealthConnectStatus): string {
  switch (status) {
    case HealthConnectStatus.Available: return '#34C759';
    default:                            return '#FF3B30';
  }
}

// Sub-screen components — full implementations extracted to their own files.
// Imported here and rendered conditionally based on the `subScreen` state.
// This replaces the inline stubs that were here during Phase 3 development.
import { StepsDetailScreen }    from './StepsDetailScreen';
import { SleepDetailScreen }    from './SleepDetailScreen';
import { WorkoutsDetailScreen } from './WorkoutsDetailScreen';

// =============================================================================
// HUB COMPONENT
// =============================================================================

export const HealthManagementScreen: React.FC<HealthManagementScreenProps> = ({
  onBack,
}) => {
  // ==========================================================================
  // ALL HOOKS — must be declared before any conditional return
  // ==========================================================================
  //
  // React requires every hook to be called on every render in the same order.
  // The sub-screen early returns below (if subScreen === 'steps' etc.) must
  // come AFTER all hook declarations — otherwise switching to a sub-screen
  // would skip the hub-state hooks and trigger "Rendered fewer hooks than
  // expected".

  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // ── Sub-screen routing ────────────────────────────────────────────────────
  const [subScreen, setSubScreen] = useState<SubScreen>('none');

  // ── Hub state ─────────────────────────────────────────────────────────────
  // Declared unconditionally even though they're only used when subScreen === 'none'.
  const [status, setStatus] = useState<HealthConnectStatus>(HealthConnectStatus.Unknown);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [todaySleep, setTodaySleep] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    const [s] = await Promise.all([checkStatus()]);
    setStatus(s);
    setLastSynced(getLastSyncedAt());

    const today = toLocalDateString(new Date());
    const stepsRows = getStepsInRange(today, today);
    setTodaySteps(stepsRows.length > 0 ? stepsRows[0].steps : null);

    const sleepRows = getSleepInRange(today, today);
    setTodaySleep(sleepRows.length > 0 ? sleepRows[0].sleepHours : null);
  }, []);

  // Skip the hub data fetch when a sub-screen is active — it's wasted work
  // since none of this state is consumed while a detail screen is showing.
  // When the user navigates back (subScreen → 'none'), loadData runs again
  // via the dependency change, so the hub is always fresh on return.
  useEffect(() => {
    if (subScreen !== 'none') return;
    loadData();
  }, [loadData, subScreen]);

  // ==========================================================================
  // CONDITIONAL RENDER — sub-screens (after all hooks)
  // ==========================================================================

  if (subScreen === 'steps') {
    return <StepsDetailScreen onBack={() => setSubScreen('none')} />;
  }
  if (subScreen === 'sleep') {
    return <SleepDetailScreen onBack={() => setSubScreen('none')} />;
  }
  if (subScreen === 'workouts') {
    return <WorkoutsDetailScreen onBack={() => setSubScreen('none')} />;
  }

  const handleSync = async () => {
    setSyncing(true);
    try {
      await sync();
      await loadData();
    } catch (e) {
      console.warn('[HC] Manual sync failed:', e);
    } finally {
      setSyncing(false);
    }
  };

  // ── Section row data ──────────────────────────────────────────────────────
  const stepsGoal   = getStepsGoal();
  const sleepGoal   = getSleepGoal();

  const stepsSubtitle = todaySteps !== null
    ? `${todaySteps.toLocaleString()} / ${stepsGoal.toLocaleString()} steps`
    : 'No data today';

  const sleepSubtitle = todaySleep !== null
    ? `${todaySleep.toFixed(1)}h / ${sleepGoal}h goal`
    : 'No data today';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Screen edges={['top']} topColor={HC_COLOR} style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health Connect</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Status badge ── */}
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
          <View style={styles.statusTextGroup}>
            <Text style={[styles.statusLabel, { color: theme.textPrimary }]}>
              {statusLabel(status)}
            </Text>
            <Text style={[styles.statusSub, { color: theme.textSecondary }]}>
              Health Connect
            </Text>
          </View>
        </View>

        {/* ── Section rows ── */}
        <View style={styles.section}>
          <SectionRow
            icon="👣"
            label="Steps"
            subtitle={stepsSubtitle}
            onPress={() => setSubScreen('steps')}
            theme={theme}
          />
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <SectionRow
            icon="🌙"
            label="Sleep"
            subtitle={sleepSubtitle}
            onPress={() => setSubScreen('sleep')}
            theme={theme}
          />
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <SectionRow
            icon="🏋️"
            label="Workouts"
            subtitle="Tap to view today's sessions"
            onPress={() => setSubScreen('workouts')}
            theme={theme}
          />
        </View>

        {/* ── Sync ── */}
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={handleSync}
          disabled={syncing}
          activeOpacity={0.75}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.syncBtnText}>Sync Now</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.lastSynced, { color: theme.textTertiary }]}>
          Last synced: {formatLastSynced(lastSynced)}
        </Text>

      </ScrollView>
    </Screen>
  );
};

// =============================================================================
// SECTION ROW
// =============================================================================

interface SectionRowProps {
  icon:     string;
  label:    string;
  subtitle: string;
  onPress:  () => void;
  theme:    AppTheme;
}

const SectionRow: React.FC<SectionRowProps> = ({ icon, label, subtitle, onPress, theme }) => (
  <TouchableOpacity style={styles.sectionRow} onPress={onPress} activeOpacity={0.65}>
    <Text style={styles.sectionIcon}>{icon}</Text>
    <View style={styles.sectionText}>
      <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>{label}</Text>
      <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>{subtitle}</Text>
    </View>
    <Text style={[styles.chevron, { color: theme.textTertiary }]}>›</Text>
  </TouchableOpacity>
);

// =============================================================================
// STYLES
// =============================================================================

// Outer hub styles — instance so SectionRow can reference them
const styles = StyleSheet.create({
  sectionRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sectionIcon:  { fontSize: 24, marginRight: 14 },
  sectionText:  { flex: 1 },
  sectionLabel: { fontSize: 16, fontWeight: '600' },
  sectionSub:   { fontSize: 13, marginTop: 2 },
  chevron:      { fontSize: 22, fontWeight: '300' },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgScreen,
    },

    // Header
    header: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 16,
      paddingVertical:   12,
      backgroundColor:   HC_COLOR,
    },
    backBtn:       { padding: 4 },
    backText:      { fontSize: 16, color: '#fff', fontWeight: '500' },
    headerTitle:   { fontSize: 20, fontWeight: '700', color: '#fff' },
    headerSpacer:  { width: 60 },

    scroll: {
      paddingBottom: 40,
    },

    // Status badge
    statusCard: {
      flexDirection:     'row',
      alignItems:        'center',
      marginHorizontal:  16,
      marginTop:         20,
      marginBottom:      8,
      padding:           16,
      borderRadius:      12,
      backgroundColor:   theme.bgCard,
    },
    statusDot: {
      width:        12,
      height:       12,
      borderRadius: 6,
      marginRight:  12,
    },
    statusTextGroup: { flex: 1 },
    statusLabel:     { fontSize: 16, fontWeight: '600' },
    statusSub:       { fontSize: 13, marginTop: 2 },

    // Section card
    section: {
      marginHorizontal: 16,
      marginTop:        16,
      borderRadius:     12,
      backgroundColor:  theme.bgCard,
      overflow:         'hidden',
    },
    divider: {
      height:           1,
      marginLeft:       54,  // aligns under text, after icon
    },

    // Sync
    syncBtn: {
      marginHorizontal: 16,
      marginTop:        24,
      paddingVertical:  14,
      borderRadius:     12,
      backgroundColor:  HC_COLOR,
      alignItems:       'center',
    },
    syncBtnDisabled: {
      opacity: 0.6,
    },
    syncBtnText: {
      fontSize:   16,
      fontWeight: '600',
      color:      '#fff',
    },
    lastSynced: {
      textAlign:  'center',
      fontSize:   13,
      marginTop:  10,
    },
  });
}
