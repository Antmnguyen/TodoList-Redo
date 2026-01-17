import { PermanentTask } from '../types/permanentTask';

/**
 * Factory for creating permanent task templates and instances.
 * Handles ID generation, field initialization, and proper copying of template data.
 */

/**
 * Options for creating a permanent task template
 */
interface CreateTemplateOptions {
  templateTitle: string;
  location?: string;
  autoRepeat?: Record<string, any>;
}

/**
 * Options for creating a task instance from a template
 */
interface CreateInstanceOptions {
  template: PermanentTask;
  dueDate?: number;
  title?: string; // Optional override for instance title
  location?: string; // Optional override for instance location
}

/**
 * Generates a unique ID for permanent tasks
 * Format: perm_timestamp_random
 */
function generatePermanentId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `perm_${timestamp}_${random}`;
}

/**
 * Generates a unique ID for task instances
 * Format: inst_timestamp_random
 */
function generateInstanceId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `inst_${timestamp}_${random}`;
}

/**
 * Creates a new permanent task template
 * 
 * @param options - Template creation options
 * @returns A new permanent task template ready to be saved
 * 
 * @example
 * const template = createTemplate({
 *   templateTitle: 'Weekly Report',
 *   location: 'Office',
 *   autoRepeat: { interval: 'weekly', dayOfWeek: 1 }
 * });
 */
export function createTemplate(options: CreateTemplateOptions): PermanentTask {
  const { templateTitle, location, autoRepeat } = options;

  if (!templateTitle || templateTitle.trim().length === 0) {
    throw new Error('Template title is required');
  }

  const permanentId = generatePermanentId();
  const createdAt = Date.now();

  return {
    id: permanentId, // For templates, id === permanentId
    permanentId,
    templateTitle: templateTitle.trim(),
    isTemplate: true,
    createdAt,
    instanceCount: 0,
    location: location?.trim() || undefined,
    autoRepeat: autoRepeat ? { ...autoRepeat } : undefined,
    completed: false, // Templates are never completed
  };
}

/**
 * Creates a new task instance from a template
 * 
 * @param options - Instance creation options
 * @returns A new task instance linked to the template
 * 
 * @example
 * const instance = createInstance({
 *   template: myTemplate,
 *   dueDate: Date.now() + 86400000, // Due tomorrow
 *   title: 'Weekly Report - Week 3'
 * });
 */
export function createInstance(options: CreateInstanceOptions): PermanentTask {
  const { template, dueDate, title, location } = options;

  if (!template.isTemplate) {
    throw new Error('Cannot create instance from a non-template task');
  }

  if (!template.permanentId) {
    throw new Error('Template must have a permanentId');
  }

  const instanceId = generateInstanceId();
  const createdAt = Date.now();

  return {
    id: instanceId,
    permanentId: template.permanentId, // Link to template
    title: title?.trim() || undefined, // Optional instance-specific title
    templateTitle: template.templateTitle, // Copy template title
    isTemplate: false,
    createdAt,
    dueDate: dueDate || undefined,
    location: location?.trim() || template.location, // Override or inherit from template
    autoRepeat: template.autoRepeat ? { ...template.autoRepeat } : undefined, // Copy autoRepeat config
    completed: false, // New instances start as incomplete
  };
}

/**
 * Creates multiple instances from a template (useful for batch operations)
 * 
 * @param template - The template to create instances from
 * @param count - Number of instances to create
 * @param dueDateGenerator - Optional function to generate due dates for each instance
 * @returns Array of new task instances
 * 
 * @example
 * const instances = createMultipleInstances(
 *   template,
 *   5,
 *   (index) => Date.now() + (index * 86400000) // Each day for 5 days
 * );
 */
export function createMultipleInstances(
  template: PermanentTask,
  count: number,
  dueDateGenerator?: (index: number) => number
): PermanentTask[] {
  if (count < 1) {
    throw new Error('Count must be at least 1');
  }

  const instances: PermanentTask[] = [];

  for (let i = 0; i < count; i++) {
    instances.push(
      createInstance({
        template,
        dueDate: dueDateGenerator ? dueDateGenerator(i) : undefined,
      })
    );
  }

  return instances;
}

/**
 * Clones a template to create a new template (useful for duplicating templates)
 * 
 * @param template - The template to clone
 * @param newTitle - Optional new title for the cloned template
 * @returns A new template with a new permanentId
 * 
 * @example
 * const clonedTemplate = cloneTemplate(existingTemplate, 'Copy of Weekly Report');
 */
export function cloneTemplate(
  template: PermanentTask,
  newTitle?: string
): PermanentTask {
  if (!template.isTemplate) {
    throw new Error('Can only clone templates, not instances');
  }

  return createTemplate({
    templateTitle: newTitle || `${template.templateTitle} (Copy)`,
    location: template.location,
    autoRepeat: template.autoRepeat ? { ...template.autoRepeat } : undefined,
  });
}

/**
 * Validates that a task object has the required fields for a template
 * 
 * @param task - The task to validate
 * @returns True if valid, throws error otherwise
 */
export function validateTemplate(task: PermanentTask): boolean {
  if (!task.permanentId) {
    throw new Error('Template must have a permanentId');
  }

  if (!task.templateTitle || task.templateTitle.trim().length === 0) {
    throw new Error('Template must have a templateTitle');
  }

  if (!task.isTemplate) {
    throw new Error('Task must be marked as a template (isTemplate: true)');
  }

  if (!task.createdAt || task.createdAt <= 0) {
    throw new Error('Template must have a valid createdAt timestamp');
  }

  return true;
}

/**
 * Validates that a task object has the required fields for an instance
 * 
 * @param task - The task to validate
 * @returns True if valid, throws error otherwise
 */
export function validateInstance(task: PermanentTask): boolean {
  if (!task.id) {
    throw new Error('Instance must have an id');
  }

  if (!task.permanentId) {
    throw new Error('Instance must have a permanentId linking to template');
  }

  if (!task.templateTitle || task.templateTitle.trim().length === 0) {
    throw new Error('Instance must have a templateTitle');
  }

  if (task.isTemplate) {
    throw new Error('Task must be marked as an instance (isTemplate: false)');
  }

  if (!task.createdAt || task.createdAt <= 0) {
    throw new Error('Instance must have a valid createdAt timestamp');
  }

  return true;
}

/**
 * Checks if a task is a template
 */
export function isTemplate(task: PermanentTask): boolean {
  return task.isTemplate === true;
}

/**
 * Checks if a task is an instance
 */
export function isInstance(task: PermanentTask): boolean {
  return task.isTemplate === false;
}

/**
 * Creates a next instance based on autoRepeat configuration
 * Useful for recurring tasks
 * 
 * @param template - The template with autoRepeat configuration
 * @param lastDueDate - The due date of the last instance
 * @returns A new instance with calculated next due date
 */
export function createNextRecurringInstance(
  template: PermanentTask,
  lastDueDate?: number
): PermanentTask {
  if (!template.autoRepeat) {
    throw new Error('Template must have autoRepeat configuration');
  }

  const { interval, dayOfWeek, dayOfMonth } = template.autoRepeat;
  const baseDate = lastDueDate || Date.now();
  let nextDueDate = baseDate;

  // Calculate next due date based on interval
  switch (interval) {
    case 'daily':
      nextDueDate = baseDate + 86400000; // +1 day
      break;
    case 'weekly':
      nextDueDate = baseDate + 604800000; // +7 days
      if (dayOfWeek !== undefined) {
        // Adjust to specific day of week if needed
        const date = new Date(nextDueDate);
        const currentDay = date.getDay();
        const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
        nextDueDate += daysToAdd * 86400000;
      }
      break;
    case 'monthly':
      const date = new Date(baseDate);
      date.setMonth(date.getMonth() + 1);
      if (dayOfMonth !== undefined) {
        date.setDate(dayOfMonth);
      }
      nextDueDate = date.getTime();
      break;
    default:
      throw new Error(`Unknown interval: ${interval}`);
  }

  return createInstance({
    template,
    dueDate: nextDueDate,
  });
}

export default {
  createTemplate,
  createInstance,
  createMultipleInstances,
  cloneTemplate,
  validateTemplate,
  validateInstance,
  isTemplate,
  isInstance,
  createNextRecurringInstance,
};