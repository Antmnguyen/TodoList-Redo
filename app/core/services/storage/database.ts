// app/core/services/storage/database.ts

/**
 * DATABASE LAYER (Infrastructure)
 * -------------------------------
 * This file is responsible for:
 *  - Opening the SQLite database file
 *  - Creating tables if they do not exist
 *  - Exporting a single shared database connection
 *
 * This file MUST NOT:
 *  - Contain task-specific logic
 *  - Contain CRUD helpers
 *  - Know what a "Task" is
 *  - Contain app or UI logic
 *
 * Think of this file as the "plumber":
 * it sets up pipes, but does not decide what flows through them.
 */

// TODO: Import SQLite library here (platform-specific)
// Example (DO NOT ADD YET):
// import * as SQLite from 'expo-sqlite';

/**
 * Open (or create) the SQLite database file.
 *
 * Conceptually:
 * - This opens a single file on disk (e.g., tasks.db)
 * - The OS decides the physical location
 * - If the file does not exist, it is created automatically
 *
 * This connection should be reused everywhere.
 */
// const db = SQLite.openDatabase('tasks.db');

/**
 * Initialize database schema.
 *
 * This function:
 * - Runs SQL to create tables if they do not exist
 * - Is safe to call on every app start
 * - Should NOT contain migrations yet (Sprint 2)
 *
 * IMPORTANT:
 * - Schema creation is infrastructure, not business logic
 * - Keep it minimal and additive only
 */
function initializeSchema() {
  /**
   * tasks table (Sprint 2 schema)
   *
   * Columns:
   * - id: TEXT PRIMARY KEY
   * - title: TEXT
   * - completed: INTEGER (0 = false, 1 = true)
   * - created_at: INTEGER (Unix timestamp, ms)
   *
   * Do NOT add optional fields yet.
   * Do NOT add constraints yet.
   */
}

/**
 * Initialize database on module load.
 *
 * This ensures:
 * - DB file is opened once
 * - Tables exist before any queries run
 *
 * This runs automatically when this file is imported.
 */
// initializeSchema();

/**
 * Export the shared database connection.
 *
 * This is the ONLY thing other files are allowed to import.
 */
// export { db };

/**
 * TODO (Future):
 * - Add schema migrations when schema evolves
 * - Move schema logic into a migrations system
 */
