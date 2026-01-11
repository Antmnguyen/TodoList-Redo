// app/core/services/storage/database.ts
import * as SQLite from 'expo-sqlite';

/**
 * Open the SQLite database file.
 * This connection is reused everywhere.
 */
const db = SQLite.openDatabaseSync('tasks.db');

export { db };