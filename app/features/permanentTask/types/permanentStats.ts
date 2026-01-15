/**
 * PERMANENT TASK STATISTICS
 * Analytics and metrics for permanent tasks
 */

import { CompletionRecord } from './permanentTask';

/**
 * Main statistics interface for a permanent task
 */
export interface PermanentTaskStats {
  completionCount: number;
  totalInstances: number;
  overallCompletionRate: number;
  completionsByDayOfWeek: DayOfWeekStats[];
  completionsByMonth: MonthStats[];
  completionsByDate: DateCompletionRecord[];
  mostLikelyDay: number;
  leastLikelyDay: number;
  mostLikelyLocation?: LocationStats;
  completionHistory: CompletionRecord[];
  lastCalculated: Date;
}

/**
 * Statistics for each day of week
 */
export interface DayOfWeekStats {
  dayOfWeek: number;
  dayName: string;
  completionCount: number;
  totalInstances: number;
  completionRate: number;
}

/**
 * Statistics for each month
 */
export interface MonthStats {
  year: number;
  month: number;
  monthName: string;
  completionCount: number;
  totalInstances: number;
  completionRate: number;
}

/**
 * Per-date completion record
 */
export interface DateCompletionRecord {
  date: Date;
  completed: boolean;
  instanceId?: string;
}

/**
 * Location-based statistics
 */
export interface LocationStats {
  lat: number;
  lng: number;
  name?: string;
  completionCount: number;
  frequency: number;
}