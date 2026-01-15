/**
 * USE PERMANENT TASK LIST HOOK
 * React hook for managing list of permanent task templates
 */

import { PermanentTask } from '../types/permanentTask';

export interface UsePermanentTaskListReturn {
  templates: PermanentTask[];
  loading: boolean;
  error: Error | null;
  createTemplate: (title: string) => Promise<PermanentTask>;
  deleteTemplate: (id: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  getActiveTemplates: () => PermanentTask[];
  getTemplatesWithAutoRepeat: () => PermanentTask[];
}

export function usePermanentTaskList(): UsePermanentTaskListReturn {
  return {
    templates: [],
    loading: false,
    error: null,
    createTemplate: async (title: string) => { throw new Error('Not implemented'); },
    deleteTemplate: async (id: string) => {},
    refreshAll: async () => {},
    getActiveTemplates: () => [],
    getTemplatesWithAutoRepeat: () => [],
  };
}