/**
 * @file appSettingsStorage.ts
 * @description Read/write helpers for the `app_settings` key-value table.
 *
 * ## Architectural position
 *
 *   This is a pure storage-layer module. It owns exactly two operations:
 *   read a setting by key, and write a setting by key. No business logic lives
 *   here — callers decide what keys mean and how values are interpreted.
 *
 * ## Synchronous API
 *
 *   Both functions are synchronous, matching the expo-sqlite `getAllSync` /
 *   `runSync` API used throughout this project. Callers do not need to await
 *   or handle promises.
 *
 * ## Current callers
 *
 *   taskActions.runMidnightJob()
 *     — reads  'midnight_job_last_run_date'  to decide whether to run today
 *     — writes 'midnight_job_last_run_date'  after the job completes
 *
 * @module storage/appSettingsStorage
 */

import { db } from './database';

/**
 * Reads a single setting value by key.
 *
 * Returns `null` if the key has never been written, so callers can distinguish
 * "key exists with value X" from "key does not exist yet" without a separate
 * existence check.
 *
 * @param key - The settings key to read
 * @returns The stored string value, or null if the key does not exist
 */
export function getAppSetting(key: string): string | null {
  const rows = db.getAllSync<{ value: string }>(
    // Simple primary-key lookup — always at most one row.
    `SELECT value FROM app_settings WHERE key = ?`,
    [key],
  );

  // Return null (not undefined) so callers can use strict equality checks:
  //   if (getAppSetting('x') === null) { ... }
  return rows.length > 0 ? rows[0].value : null;
}

/**
 * Writes a setting value. Creates the row if it does not exist, or
 * overwrites it if it does — INSERT OR REPLACE handles both cases atomically.
 *
 * @param key   - The settings key to write
 * @param value - The string value to store
 */
export function setAppSetting(key: string, value: string): void {
  db.runSync(
    // INSERT OR REPLACE: if the key already exists the old row is deleted and
    // a new one inserted. This is equivalent to an upsert for a PRIMARY KEY.
    `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
    [key, value],
  );
}
