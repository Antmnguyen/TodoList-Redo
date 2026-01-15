/**
 * PERMANENT TASK TYPES
 * Core type definitions for permanent/preset tasks
 */

import { Task } from '../../../core/types/task';
import { PermanentTaskStats } from './permanentStats';

/**
 * PermanentTask extends base Task with preset-specific features
 */
export interface PermanentTask extends Task {
  kind: 'permanent';
  permanentId: string;
  isTemplate: boolean;
  templateTitle: string;
  autoRepeat?: AutoRepeatConfig;
  stats?: PermanentTaskStats;
  instanceCount?: number;
}

/**
 * Auto-repeat configuration
 */
export interface AutoRepeatConfig {
  enabled: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  nextScheduledDate?: Date;
}

/**
 * Completion record for a single instance
 */
export interface CompletionRecord {
  completedAt: Date;
  instanceId: string;
  dayOfWeek: number;
  location?: {
    lat: number;
    lng: number;
    name?: string;
  };
}