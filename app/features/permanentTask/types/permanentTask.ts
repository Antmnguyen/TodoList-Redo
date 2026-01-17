/**
 * Represents a permanent task template or instance.
 */
export interface PermanentTask {
  /** Unique ID for the instance (used in tasks table) */
  id: string;

  /** Unique ID for the template this task belongs to */
  permanentId: string;

  /** Title of the task (instance) */
  title?: string;

  /** Title of the template */
  templateTitle: string;

  /** Is this a template or an instance */
  isTemplate: boolean;

  /** Timestamp in milliseconds */
  createdAt: number;

  /** Optional due date for the instance */
  dueDate?: number;

  /** Optional location for template or instance */
  location?: string;

  /** Optional auto-repeat configuration */
  autoRepeat?: Record<string, any>;

  /** Number of instances created from template (templates only) */
  instanceCount?: number;

  /** Completion status (instances only) */
  completed?: boolean;
}

/**
 * Statistics tracked for a permanent task template
 */
export interface TemplateStats {
  templateId: string;
  completionCount: number;
  completionRate: number;
  currentStreak: number;
  maxStreak: number;
  completionMon: number;
  completionTue: number;
  completionWed: number;
  completionThu: number;
  completionFri: number;
  completionSat: number;
  completionSun: number;
  lastUpdatedAt: number;
}
