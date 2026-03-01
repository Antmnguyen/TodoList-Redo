/**
 * @file schema/appSettings.ts
 * @description Schema for the `app_settings` table — a simple key-value store
 * for app-level persistent state that doesn't belong in any feature table.
 *
 * ## Why this table exists
 *
 *   Some app-level logic needs to persist a small piece of state across cold
 *   starts without it being a "task", "category", or any domain concept.
 *   The midnight job date gate is the first use case: it needs to remember
 *   "which calendar date did I last run on?" so it doesn't re-run if the
 *   user force-quits and reopens the app on the same day.
 *
 *   Rather than pulling in @react-native-async-storage/async-storage (an extra
 *   package dependency) or scattering ad-hoc columns into unrelated tables,
 *   we use a single lightweight key-value table backed by the same SQLite
 *   database that the rest of the app already uses.
 *
 * ## Schema
 *
 *   key   TEXT PRIMARY KEY  — string identifier, e.g. 'midnight_job_last_run_date'
 *   value TEXT NOT NULL     — string value, e.g. '2026-02-27'
 *
 *   Both columns are TEXT. The caller is responsible for serialising and
 *   deserialising values (e.g. JSON.stringify for objects, toString for dates).
 *   Keeping the schema untyped at the DB level avoids the need for migrations
 *   when a value's meaning changes.
 *
 * ## Current keys
 *
 *   'midnight_job_last_run_date'  — 'YYYY-MM-DD' string of the last calendar
 *                                   date on which runMidnightJob() completed.
 *                                   Written by taskActions.runMidnightJob().
 *                                   Read by taskActions.runMidnightJob().
 *
 * @module schema/appSettings
 */

import { db } from '../database';

/**
 * Creates the `app_settings` table if it does not already exist.
 *
 * Safe to call on every launch — `CREATE TABLE IF NOT EXISTS` is idempotent.
 * No migrations are needed here: new keys are simply inserted as they are
 * introduced; existing keys are left untouched.
 */
export function initializeAppSettingsSchema(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      -- Arbitrary string key — callers define their own key constants.
      key   TEXT PRIMARY KEY,
      -- Arbitrary string value — TEXT is flexible enough for dates, numbers,
      -- and JSON blobs without requiring schema changes per value type.
      value TEXT NOT NULL
    );
  `);

  console.log('✅ App settings table initialized');
}
