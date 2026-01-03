// core/types/task.ts

/**
 * Core Task Interface
 * Minimal for Sprint 1
 * Optional fields allow future features to plug in without touching core
 */
export interface Task {
  // ===== CORE =====
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;

  // ===== OPTIONAL EXTENSIONS =====
  // Can be added later by features
  description?: string;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: Date;
  startDate?: Date; // Hidden until start date
  subtasks?: SubTask[];
  recurring?: RecurringConfig;
  location?: LocationData;
  googleCalendarEventId?: string;
  googleFitActivityId?: string;
  metadata?: Record<string, any>;
}

/**
 * SubTask interface
 * Optional for now, feature can implement later
 */
export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

/**
 * Recurring task config placeholder
 * Feature-specific logic implemented in recurring feature module
 */
export interface RecurringConfig {
  enabled: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval?: number;
  nextOccurrence?: Date;
}

/**
 * Location placeholder
 * Feature-specific logic implemented in geofencing/location module
 */
export interface LocationData {
  lat: number;
  lng: number;
  radius?: number;
  name?: string;
  requiresLocationToComplete?: boolean;
}

/**
 * TaskFactory
 * 
 * This is a utility class to create and manipulate Task objects.
 * For Sprint 1, it handles only the minimal required fields for tasks:
 * - id: unique identifier
 * - title: task name
 * - completed: boolean to mark task completion
 * - createdAt: timestamp of task creation
 * 
 * Future features like priority, subtasks, recurring tasks, Google Calendar/ Fit
 * integration, location, etc., can be added later without breaking this core logic.
 */
export class TaskFactory 
{
  /**
   * generateId
   * Generates a unique ID string for each task.
   * Format: "task_" + current timestamp + random string
   * Ensures tasks have unique identifiers even if created quickly in succession.
   */
  static generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * create
   * Factory method to create a new Task object.
   * Only requires a title for Sprint 1.
   * Sets default values for:
   * - completed: false
   * - createdAt: current date and time
   */
  static create(title: string): Task {
    return {
      id: this.generateId(),
      title,
      completed: false,
      createdAt: new Date(),
    };
  }

  /**
   * complete
   * Marks a given task as completed.
   * Returns a **new object** (immutable update) with completed = true.
   * Future logic can expand here to:
   * - Update streaks
   * - Update completion history
   * - Trigger analytics events
   */
  static complete(task: Task): Task 
  {
    return { ...task, completed: true };
  }

  /**
   * uncomplete
   * Marks a given task as not completed (undo).
   * Returns a **new object** (immutable update) with completed = false.
   * Future logic can expand here to:
   * - Adjust streaks
   * - Remove last completion from history
   */
  static uncomplete(task: Task): Task 
  {
    return { ...task, completed: false };
  }
}
