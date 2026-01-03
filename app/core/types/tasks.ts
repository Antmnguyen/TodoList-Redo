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
 * Task factory for creating new tasks
 * Only handles Sprint 1 minimal fields
 */
export class TaskFactory {
  static generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static create(title: string): Task {
    return {
      id: this.generateId(),
      title,
      completed: false,
      createdAt: new Date(),
    };
  }

  static complete(task: Task): Task {
    return { ...task, completed: true };
  }

  static uncomplete(task: Task): Task {
    return { ...task, completed: false };
  }
}