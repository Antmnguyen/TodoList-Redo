// app/core/services/storage/schema/healthConnect.ts
// =============================================================================
// HEALTH CONNECT SCHEMA
// =============================================================================
//
// Creates four tables:
//
//   health_connect_mappings  — threshold → permanent template assignments.
//                              One row per mapping; drives auto-completion
//                              during sync.
//
//   health_connect_meta      — key-value store for display settings:
//                              per-type goals, colour-toggle flags,
//                              last_synced_at.
//
//   health_steps_log         — one row per calendar date ('YYYY-MM-DD').
//                              Stores the device's total step count for that
//                              day. Written (upserted) on every sync so stats
//                              survive Health Connect data being wiped.
//
//   health_sleep_log         — one row per calendar date representing the
//                              night that ended on that date. Stores sleep
//                              duration in hours. Written on every sync for
//                              the same durability reason.
//
// None of these tables have foreign-key dependencies on the core tasks schema.
//
// =============================================================================

import { db } from '../database';

export function initializeHealthConnectSchema(): void {
  // ── Mappings ──────────────────────────────────────────────────────────────
  db.execSync(`
    CREATE TABLE IF NOT EXISTS health_connect_mappings (
      id TEXT PRIMARY KEY,
      permanentId TEXT NOT NULL,
      dataType TEXT NOT NULL,          -- 'steps' | 'sleep' | 'workout'
      stepsGoal INTEGER,               -- minimum step count (steps mappings)
      sleepHours REAL,                 -- minimum hours (sleep mappings)
      exerciseType INTEGER,            -- integer constant; 0 = any (workout mappings)
      minDurationMinutes INTEGER,      -- minimum workout duration in minutes
      autoSchedule INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1
    );
  `);

  // ── Meta key-value store ──────────────────────────────────────────────────
  db.execSync(`
    CREATE TABLE IF NOT EXISTS health_connect_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // ── Steps history ─────────────────────────────────────────────────────────
  // One row per local calendar date. `steps` is the summed total for that day
  // (Health Connect stores steps as short intervals — we sum them at sync time).
  // `synced_at` is a Unix ms timestamp of when this row was last written.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS health_steps_log (
      date       TEXT    PRIMARY KEY,   -- 'YYYY-MM-DD' local date
      steps      INTEGER NOT NULL,
      synced_at  INTEGER NOT NULL
    );
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_steps_date
      ON health_steps_log (date);
  `);

  // ── Sleep history ─────────────────────────────────────────────────────────
  // One row per local calendar date representing the night that ended on that
  // date (e.g. a session 23:00→07:00 is stored under the morning date).
  // `sleep_hours` is the total session duration in hours (float).
  db.execSync(`
    CREATE TABLE IF NOT EXISTS health_sleep_log (
      date         TEXT  PRIMARY KEY,   -- 'YYYY-MM-DD' — the morning the sleep ended
      sleep_hours  REAL  NOT NULL,
      synced_at    INTEGER NOT NULL
    );
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_sleep_date
      ON health_sleep_log (date);
  `);

  console.log('✅ Health Connect schema created (mappings, meta, steps_log, sleep_log)');
}
