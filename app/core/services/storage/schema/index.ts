// app/core/services/storage/schema/index.ts
import { initializeCoreSchema } from './core';
import { createPermanentTasksSchema } from './permanentTask'; // <- import the permanent schema
/**
 * Initialize all database schemas.
 * Currently: Sprint 2 only has core tasks table active.
 * Future sprints: uncomment/init other schemas here
 */
export function initializeAllSchemas(): void {
  try {
    initializeCoreSchema();
     // Permanent tasks schema
    createPermanentTasksSchema();
    console.log('✅ All active schemas initialized');
  } catch (error) {
    console.error('❌ Schema initialization failed:', error);
    throw error;
  }
}
