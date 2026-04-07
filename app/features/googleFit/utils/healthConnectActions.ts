// app/features/googleFit/utils/healthConnectActions.ts
// =============================================================================
// HEALTH CONNECT ACTIONS
// =============================================================================
//
// Business logic layer for the Health Connect integration.
//
// Public API:
//   checkStatus()               — query SDK availability
//   requestPermissions()        — prompt the OS permission dialog
//   getTodaySummary()           — read today's steps, sleep, workouts from HC
//   sync()                      — full sync: read HC → persist history → auto-complete
//
// Sync contract:
//   - Always upserts today's steps and sleep into local history tables so stats
//     survive Health Connect being wiped.
//   - For each enabled mapping, calls evaluateThreshold(). If met:
//       • Finds today's incomplete instance of the template.
//       • If found → completes it.
//       • If not found + autoSchedule=true + NO instance exists today at all
//         (hasTodaysInstance check) → creates an instance then completes it.
//       • If an instance exists but is already completed → no-op (no duplicate).
//   - Never blocks app render — callers fire-and-forget with .catch(console.warn).
//
// Architecture:
//   - This layer is the ONLY file that imports react-native-health-connect.
//   - Calls into core storage and domain layers as a consumer.
//   - Never touches permanent task types, storage, or actions directly except
//     through the taskActions router.
//
// =============================================================================

import {
  initialize,
  getSdkStatus,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { DeviceEventEmitter } from 'react-native';

import { db } from '../../../core/services/storage/database';
import {
  getAllEnabledMappings,
  pruneOrphanedMappings,
  upsertStepsForDate,
  upsertSleepForDate,
  setLastSyncedAt,
} from '../../../core/services/storage/healthConnectStorage';
import { createTask, completeTask } from '../../../core/domain/taskActions';
import { toLocalDateString } from '../../../core/utils/statsCalculations';

import {
  HealthConnectStatus,
  HealthConnectMapping,
  TodaySummary,
  WorkoutSession,
} from '../types/healthConnect';

// =============================================================================
// STATUS
// =============================================================================

/**
 * Check whether Health Connect is installed and available on this device.
 * Maps the SDK integer status to our `HealthConnectStatus` enum.
 */
export async function checkStatus(): Promise<HealthConnectStatus> {
  try {
    const status = await getSdkStatus();
    switch (status) {
      case SdkAvailabilityStatus.SDK_AVAILABLE:
        return HealthConnectStatus.Available;
      case SdkAvailabilityStatus.SDK_UNAVAILABLE:
        return HealthConnectStatus.NotInstalled;
      case SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED:
        return HealthConnectStatus.NotSupported;
      default:
        return HealthConnectStatus.Unknown;
    }
  } catch {
    return HealthConnectStatus.Unknown;
  }
}

// =============================================================================
// PERMISSIONS
// =============================================================================

/**
 * Request read permissions for steps, sleep, and exercise from the OS.
 * Shows the Health Connect permission dialog if any permission is not yet granted.
 * Returns the list of permissions that were granted after the request.
 */
export async function requestPermissions(): Promise<string[]> {
  const granted = await requestPermission([
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'SleepSession' },
    { accessType: 'read', recordType: 'ExerciseSession' },
  ]);
  return granted.map((p: { recordType: string }) => p.recordType);
}

// =============================================================================
// READ TODAY'S DATA FROM HEALTH CONNECT
// =============================================================================

/**
 * Build the start-of-today timestamp (midnight local time) as an ISO string.
 */
function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Read today's steps, last night's sleep, and today's workouts from Health Connect.
 *
 * Steps:   Sum all interval records since local midnight.
 * Sleep:   24-hour lookback from midnight — filters for sessions whose endTime
 *          falls on or after today (handles sessions that span midnight).
 * Workouts: All ExerciseSession records since local midnight.
 *
 * Returns zeroes / empty array gracefully when data is unavailable.
 */
export async function getTodaySummary(): Promise<TodaySummary> {
  await initialize();

  const now = new Date();
  const todayStart = startOfTodayISO();
  const nowISO = now.toISOString();

  // ── Steps ──────────────────────────────────────────────────────────────────
  let steps = 0;
  try {
    const stepsResult = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: todayStart,
        endTime: nowISO,
      },
    });
    for (const record of stepsResult.records) {
      steps += (record as any).count ?? 0;
    }
  } catch (e) {
    console.warn('[HC] Steps read failed:', e);
  }

  // ── Sleep ──────────────────────────────────────────────────────────────────
  // Query with a 24h lookback so we catch sessions that started yesterday
  // evening. We only keep sessions whose endTime is >= today's start (i.e.
  // the session ended this morning).
  let sleepHours = 0;
  try {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sleepResult = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: yesterday,
        endTime: nowISO,
      },
    });
    for (const record of sleepResult.records) {
      const r = record as any;
      // Only count sessions that ended on or after today's midnight
      if (r.endTime >= todayStart) {
        const durationMs =
          new Date(r.endTime).getTime() - new Date(r.startTime).getTime();
        sleepHours += durationMs / (1000 * 60 * 60);
      }
    }
  } catch (e) {
    console.warn('[HC] Sleep read failed:', e);
  }

  // ── Workouts ───────────────────────────────────────────────────────────────
  const workouts: WorkoutSession[] = [];
  try {
    const workoutResult = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: todayStart,
        endTime: nowISO,
      },
    });
    for (const record of workoutResult.records) {
      const r = record as any;
      const durationMs =
        new Date(r.endTime).getTime() - new Date(r.startTime).getTime();
      workouts.push({
        id: r.metadata?.id ?? '',
        startTime: r.startTime,
        endTime: r.endTime,
        exerciseType: r.exerciseType ?? 0,
        durationMinutes: durationMs / (1000 * 60),
        title: r.title,
      });
    }
  } catch (e) {
    console.warn('[HC] Workouts read failed:', e);
  }

  return { steps, sleepHours, workouts };
}

// =============================================================================
// THRESHOLD EVALUATION
// =============================================================================

/**
 * Returns true if the given today-summary satisfies the mapping's threshold.
 */
function evaluateThreshold(
  mapping: HealthConnectMapping,
  summary: TodaySummary,
): boolean {
  switch (mapping.dataType) {
    case 'steps':
      return mapping.stepsGoal !== undefined && summary.steps >= mapping.stepsGoal;

    case 'sleep':
      return (
        mapping.sleepHours !== undefined && summary.sleepHours >= mapping.sleepHours
      );

    case 'workout': {
      if (summary.workouts.length === 0) return false;
      return summary.workouts.some(w => {
        // exerciseType 0 = wildcard (any workout)
        const typeMatch =
          mapping.exerciseType === 0 || w.exerciseType === mapping.exerciseType;
        const durationMatch =
          mapping.minDurationMinutes === undefined ||
          w.durationMinutes >= mapping.minDurationMinutes;
        return typeMatch && durationMatch;
      });
    }

    default:
      return false;
  }
}

// =============================================================================
// PENDING INSTANCE LOOKUP
// =============================================================================

interface PendingInstanceRow {
  id: string;
  title: string;
  category_id: string | null;
  due_date: number | null;
  created_at: number;
  templateId: string;
  templateTitle: string;
}

/**
 * Find an incomplete permanent task instance for `permanentId` that is due
 * today (due_date within today's midnight-to-midnight window). Returns null
 * if none is found — meaning the task was already completed or doesn't exist.
 */
function findTodaysPendingInstance(permanentId: string): PendingInstanceRow | null {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const rows = db.getAllSync<PendingInstanceRow>(
    `SELECT t.id, t.title, t.category_id, t.due_date, t.created_at,
            ti.templateId, tmpl.templateTitle
     FROM   tasks t
     INNER JOIN template_instances ti ON ti.instanceId = t.id
     INNER JOIN templates tmpl ON tmpl.permanentId = ti.templateId
     WHERE  ti.templateId = ?
       AND  t.completed = 0
       AND  t.due_date BETWEEN ? AND ?`,
    [permanentId, dayStart.getTime(), dayEnd.getTime()],
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Returns true if ANY instance of `permanentId` exists today, regardless of
 * completion status. Used to guard the autoSchedule branch so we never create
 * a second instance on a day where one was already assigned (even if completed).
 */
function hasTodaysInstance(permanentId: string): boolean {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const row = db.getFirstSync<{ id: string }>(
    `SELECT t.id
     FROM   tasks t
     INNER JOIN template_instances ti ON ti.instanceId = t.id
     WHERE  ti.templateId = ?
       AND  t.due_date BETWEEN ? AND ?`,
    [permanentId, dayStart.getTime(), dayEnd.getTime()],
  );

  return row !== null;
}

// =============================================================================
// SYNC
// =============================================================================

/**
 * Full Health Connect sync.
 *
 *  1. Checks SDK availability — exits early if not available.
 *  2. Reads today's summary from Health Connect.
 *  3. Persists steps and sleep into local history tables (survives HC wipe).
 *  4. Prunes orphaned mapping rows (deleted templates).
 *  5. For each enabled mapping, evaluates the threshold and auto-completes
 *     the mapped task if the threshold is met.
 *
 * This function is always called fire-and-forget:
 *   sync().catch(console.warn);
 * Never await it on the render path.
 */
export async function sync(): Promise<void> {
  const status = await checkStatus();
  if (status !== HealthConnectStatus.Available) {
    console.log('[HC] Sync skipped — HC not available:', status);
    return;
  }

  let summary: TodaySummary;
  try {
    summary = await getTodaySummary();
  } catch (e) {
    console.warn('[HC] getTodaySummary failed:', e);
    return;
  }

  const today = toLocalDateString(new Date());

  // Persist history regardless of mappings so stats are always up to date
  upsertStepsForDate(today, summary.steps);
  if (summary.sleepHours > 0) {
    upsertSleepForDate(today, summary.sleepHours);
  }

  // Clean up any stale mapping rows
  pruneOrphanedMappings();

  // Evaluate each enabled mapping
  const mappings = getAllEnabledMappings();
  for (const mapping of mappings) {
    if (!evaluateThreshold(mapping, summary)) continue;

    try {
      // Look for an existing incomplete instance due today
      const pending = findTodaysPendingInstance(mapping.permanentId);

      if (pending) {
        // Build a minimal Task object to pass to the universal completeTask router
        await completeTask({
          id: pending.id,
          title: pending.title ?? pending.templateTitle,
          completed: false,
          createdAt: new Date(pending.created_at),
          kind: 'permanent',
          dueDate: pending.due_date ? new Date(pending.due_date) : undefined,
          categoryId: pending.category_id ?? undefined,
          metadata: {
            permanentId: mapping.permanentId,
            templateTitle: pending.templateTitle,
            isTemplate: false,
          },
        });
        console.log(`[HC] Auto-completed instance ${pending.id} for template ${mapping.permanentId}`);
      } else if (mapping.autoSchedule && !hasTodaysInstance(mapping.permanentId)) {
        // No instance today (completed or otherwise) — create one then complete it
        const template = db.getFirstSync<{ templateTitle: string; category_id: string | null }>(
          'SELECT templateTitle, category_id FROM templates WHERE permanentId = ?',
          [mapping.permanentId],
        );
        if (!template) continue;

        const now = new Date();
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);

        const created = await createTask(template.templateTitle, 'permanent', {
          templateId: mapping.permanentId,
          dueDate: todayMidnight,
          categoryId: template.category_id ?? undefined,
        } as any);

        await completeTask(created);
        console.log(`[HC] Auto-scheduled + completed for template ${mapping.permanentId}`);
      }
      // else: threshold met but no instance + autoSchedule=false → do nothing
    } catch (e) {
      console.warn(`[HC] Failed to process mapping ${mapping.id}:`, e);
    }
  }

  setLastSyncedAt(new Date().toISOString());

  // Notify any mounted useTasks() hooks that they should reload the task list.
  // This covers the case where sync() auto-completed a task in the background —
  // without this event the UI would show the task as still pending until the
  // user navigates away and back. DeviceEventEmitter is in-process and
  // synchronous on the JS thread, so no async issues.
  DeviceEventEmitter.emit('healthConnectSyncComplete');

  console.log('[HC] Sync complete. Steps:', summary.steps, 'Sleep:', summary.sleepHours.toFixed(1) + 'h', 'Workouts:', summary.workouts.length);
}
