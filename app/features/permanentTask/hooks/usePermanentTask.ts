/**
 * USE PERMANENT STATS HOOK
 * React hook for accessing permanent task statistics
 */

import { PermanentTaskStats } from '../types/permanentStats';

export interface UsePermanentStatsReturn {
  stats: PermanentTaskStats | null;
  loading: boolean;
  error: Error | null;
  isConsistent: boolean;
  preferredDay: string;
  averageCompletionRate: number;
  refresh: () => Promise<void>;
}

export function usePermanentStats(templateId: string): UsePermanentStatsReturn {
  return {
    stats: null,
    loading: false,
    error: null,
    isConsistent: false,
    preferredDay: '',
    averageCompletionRate: 0,
    refresh: async () => {},
  };
}