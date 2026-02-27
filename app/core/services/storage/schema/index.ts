/**
 * @file schema/index.ts
 * @description Entry point for all database schema initialization.
 *
 * Called once at app startup (in App.tsx) before any storage service is used.
 * Each initializer is responsible for:
 *   - Creating its table(s) with CREATE TABLE IF NOT EXISTS (idempotent).
 *   - Running any inline ALTER TABLE migrations needed for existing installs.
 *   - Creating indexes on its table(s).
 *
 * Initialization order matters — later steps may depend on tables created
 * by earlier steps (e.g. the backfill in step 4 reads from `tasks` and
 * `template_instances`, so steps 1 and 2 must run first).
 *
 * Initialization order:
 *   1. initializeCoreSchema()         — creates `tasks`
 *   2. createPermanentTasksSchema()   — creates `templates`, `template_instances`, `template_stats`
 *   3. initializeCategoriesSchema()   — creates `categories`, seeds defaults
 *   4. initializeCompletionsSchema()  — creates `completion_log` + indexes + backfill
 *
 * @module schema/index
 */

import { initializeCoreSchema } from './core';
import { createPermanentTasksSchema } from './permanentTask';
import { initializeCategoriesSchema } from './categories';
import { initializeCompletionsSchema } from './completions';
// App-level key-value store — no dependencies on other tables, so it can
// safely be initialized last.
import { initializeAppSettingsSchema } from './appSettings';

/**
 * Initializes all active database schemas in dependency order.
 *
 * Throws if any schema fails to initialize — a schema error at startup
 * is unrecoverable and should surface immediately rather than causing
 * silent data corruption later.
 */
export function initializeAllSchemas(): void {
  try {
    // Step 1: Core tasks table (must be first — everything else depends on it)
    initializeCoreSchema();

    // Step 2: Permanent task templates, instances, and stats
    createPermanentTasksSchema();

    // Step 3: Categories table with seeded defaults
    initializeCategoriesSchema();

    // Step 4: Completion event log (reads tasks + template_instances in backfill,
    //         so steps 1 and 2 must have completed before this runs)
    initializeCompletionsSchema();

    // Step 5: App-level key-value settings store.
    // No dependencies on any other table — always safe to run last.
    // Current uses: midnight job last-run date gate (taskActions.runMidnightJob).
    initializeAppSettingsSchema();

    console.log('✅ All active schemas initialized');
  } catch (error) {
    console.error('❌ Schema initialization failed:', error);
    throw error;
  }
}
