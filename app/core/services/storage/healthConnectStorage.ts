// app/core/services/storage/healthConnectStorage.ts
// =============================================================================
// HEALTH CONNECT STORAGE LAYER
// =============================================================================
//
// All reads and writes for the four Health Connect tables:
//
//   health_connect_mappings  — threshold → template assignments
//   health_connect_meta      — key-value store (goals, toggles, last synced)
//   health_steps_log         — one row per calendar date, total step count
//   health_sleep_log         — one row per calendar date, sleep hours
//
// The history tables (steps/sleep) are upserted on every sync so stats
// survive Health Connect being wiped or the user switching devices.
//
// Data flow:
//   healthConnectActions → healthConnectStorage → SQLite
//
// =============================================================================

import { db } from './database';
import { HealthConnectMapping } from '../../../features/googleFit/types/healthConnect';

// =============================================================================
// ROW SHAPES
// =============================================================================

interface MappingRow {
  id: string;
  permanentId: string;
  templateTitle: string | null;
  dataType: string;
  stepsGoal: number | null;
  sleepHours: number | null;
  exerciseType: number | null;
  minDurationMinutes: number | null;
  autoSchedule: number;
  enabled: number;
}

interface MetaRow {
  key: string;
  value: string;
}

// =============================================================================
// MAPPINGS
// =============================================================================

/**
 * Insert or replace a mapping row.
 */
export function saveMapping(mapping: HealthConnectMapping): void {
  db.runSync(
    `INSERT OR REPLACE INTO health_connect_mappings
      (id, permanentId, dataType, stepsGoal, sleepHours,
       exerciseType, minDurationMinutes, autoSchedule, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mapping.id,
      mapping.permanentId,
      mapping.dataType,
      mapping.stepsGoal ?? null,
      mapping.sleepHours ?? null,
      mapping.exerciseType ?? null,
      mapping.minDurationMinutes ?? null,
      mapping.autoSchedule ? 1 : 0,
      mapping.enabled ? 1 : 0,
    ]
  );
}

/**
 * Delete a mapping by its id.
 */
export function deleteMapping(id: string): void {
  db.runSync('DELETE FROM health_connect_mappings WHERE id = ?', [id]);
}

/**
 * Return all enabled mappings whose permanentId still exists in the templates
 * table. This filters out orphans without a separate prune step.
 */
export function getAllEnabledMappings(): HealthConnectMapping[] {
  const rows = db.getAllSync<MappingRow>(
    `SELECT m.*, t.templateTitle
     FROM health_connect_mappings m
     INNER JOIN templates t ON t.permanentId = m.permanentId
     WHERE m.enabled = 1`
  );
  return rows.map(rowToMapping);
}

/**
 * Return all mappings (enabled and disabled) for display in the UI.
 * Also joins against templates so orphaned rows are excluded.
 */
export function getAllMappings(): HealthConnectMapping[] {
  const rows = db.getAllSync<MappingRow>(
    `SELECT m.*, t.templateTitle
     FROM health_connect_mappings m
     INNER JOIN templates t ON t.permanentId = m.permanentId`
  );
  return rows.map(rowToMapping);
}

/**
 * Delete any mapping rows whose permanentId no longer exists in templates.
 * Called during sync as a safety net for deleted templates.
 */
export function pruneOrphanedMappings(): void {
  db.runSync(
    `DELETE FROM health_connect_mappings
     WHERE permanentId NOT IN (SELECT permanentId FROM templates)`
  );
}

// =============================================================================
// META (goals, toggles, last sync time)
// =============================================================================

function getMetaValue(key: string): string | null {
  const row = db.getFirstSync<MetaRow>(
    'SELECT value FROM health_connect_meta WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

function setMetaValue(key: string, value: string): void {
  db.runSync(
    'INSERT OR REPLACE INTO health_connect_meta (key, value) VALUES (?, ?)',
    [key, value]
  );
}

/** ISO timestamp of the last successful sync, or null if never synced. */
export function getLastSyncedAt(): string | null {
  return getMetaValue('last_synced_at');
}

export function setLastSyncedAt(iso: string): void {
  setMetaValue('last_synced_at', iso);
}

/** Steps display goal (integer). Defaults to 10000 if not set. */
export function getStepsGoal(): number {
  const v = getMetaValue('steps_goal');
  return v !== null ? parseInt(v, 10) : 10000;
}

export function setStepsGoal(goal: number): void {
  setMetaValue('steps_goal', String(goal));
}

/** Sleep display goal in hours (float). Defaults to 8 if not set. */
export function getSleepGoal(): number {
  const v = getMetaValue('sleep_goal');
  return v !== null ? parseFloat(v) : 8;
}

export function setSleepGoal(hours: number): void {
  setMetaValue('sleep_goal', String(hours));
}

/** Whether the goal-colour highlight is on for steps. Defaults to true. */
export function getStepsColorEnabled(): boolean {
  const v = getMetaValue('steps_color_enabled');
  return v !== null ? v === '1' : true;
}

export function setStepsColorEnabled(enabled: boolean): void {
  setMetaValue('steps_color_enabled', enabled ? '1' : '0');
}

/** Whether the goal-colour highlight is on for sleep. Defaults to true. */
export function getSleepColorEnabled(): boolean {
  const v = getMetaValue('sleep_color_enabled');
  return v !== null ? v === '1' : true;
}

export function setSleepColorEnabled(enabled: boolean): void {
  setMetaValue('sleep_color_enabled', enabled ? '1' : '0');
}

// =============================================================================
// STEPS HISTORY
// =============================================================================

export interface StepsDayRecord {
  date: string;        // 'YYYY-MM-DD'
  steps: number;
  syncedAt: number;    // Unix ms
}

/**
 * Upsert today's step total. Called by the sync engine after summing all
 * Health Connect interval records for the day.
 */
export function upsertStepsForDate(date: string, steps: number): void {
  db.runSync(
    `INSERT OR REPLACE INTO health_steps_log (date, steps, synced_at)
     VALUES (?, ?, ?)`,
    [date, steps, Date.now()]
  );
}

/**
 * Return step records for a date range (inclusive). Used by WeekBarGraph,
 * MonthCalendarGraph, and stats calculations.
 *
 * @param from  'YYYY-MM-DD' start date
 * @param to    'YYYY-MM-DD' end date
 */
export function getStepsInRange(from: string, to: string): StepsDayRecord[] {
  return db.getAllSync<{ date: string; steps: number; synced_at: number }>(
    `SELECT date, steps, synced_at
     FROM health_steps_log
     WHERE date BETWEEN ? AND ?
     ORDER BY date ASC`,
    [from, to]
  ).map(r => ({ date: r.date, steps: r.steps, syncedAt: r.synced_at }));
}

/**
 * Return the single highest step count day ever recorded.
 */
export function getStepsPersonalBest(): StepsDayRecord | null {
  const row = db.getFirstSync<{ date: string; steps: number; synced_at: number }>(
    `SELECT date, steps, synced_at
     FROM health_steps_log
     ORDER BY steps DESC
     LIMIT 1`
  );
  return row ? { date: row.date, steps: row.steps, syncedAt: row.synced_at } : null;
}

// =============================================================================
// SLEEP HISTORY
// =============================================================================

export interface SleepDayRecord {
  date: string;         // 'YYYY-MM-DD' — the morning the sleep ended
  sleepHours: number;
  syncedAt: number;     // Unix ms
}

/**
 * Upsert last night's sleep duration. Called by the sync engine.
 * `date` is the local calendar date on which the session ended (the morning).
 */
export function upsertSleepForDate(date: string, sleepHours: number): void {
  db.runSync(
    `INSERT OR REPLACE INTO health_sleep_log (date, sleep_hours, synced_at)
     VALUES (?, ?, ?)`,
    [date, sleepHours, Date.now()]
  );
}

/**
 * Return sleep records for a date range (inclusive).
 *
 * @param from  'YYYY-MM-DD' start date
 * @param to    'YYYY-MM-DD' end date
 */
export function getSleepInRange(from: string, to: string): SleepDayRecord[] {
  return db.getAllSync<{ date: string; sleep_hours: number; synced_at: number }>(
    `SELECT date, sleep_hours, synced_at
     FROM health_sleep_log
     WHERE date BETWEEN ? AND ?
     ORDER BY date ASC`,
    [from, to]
  ).map(r => ({ date: r.date, sleepHours: r.sleep_hours, syncedAt: r.synced_at }));
}

/**
 * Return the single best sleep night ever recorded.
 */
export function getSleepPersonalBest(): SleepDayRecord | null {
  const row = db.getFirstSync<{ date: string; sleep_hours: number; synced_at: number }>(
    `SELECT date, sleep_hours, synced_at
     FROM health_sleep_log
     ORDER BY sleep_hours DESC
     LIMIT 1`
  );
  return row ? { date: row.date, sleepHours: row.sleep_hours, syncedAt: row.synced_at } : null;
}

// =============================================================================
// HELPERS
// =============================================================================

function rowToMapping(row: MappingRow): HealthConnectMapping {
  return {
    id: row.id,
    permanentId: row.permanentId,
    templateTitle: row.templateTitle ?? undefined,
    dataType: row.dataType as HealthConnectMapping['dataType'],
    stepsGoal: row.stepsGoal ?? undefined,
    sleepHours: row.sleepHours ?? undefined,
    exerciseType: row.exerciseType ?? undefined,
    minDurationMinutes: row.minDurationMinutes ?? undefined,
    autoSchedule: row.autoSchedule === 1,
    enabled: row.enabled === 1,
  };
}
