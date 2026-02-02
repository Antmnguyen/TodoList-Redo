// features/permanent/utils/permanentTaskActions.ts

import { Task } from '../../../core/types/task';
import { PermanentTask } from '../types/permanentTask';
import {
  createTemplate,
  createInstance,
  validateTemplate,
  validateInstance,
  isTemplate,
  createNextRecurringInstance,
} from './permanentTaskFactory';
import {
  savePermanentTemplate,
  savePermanentInstance,
  deletePermanentTemplate as deletePermanentTemplateDB,
  deletePermanentInstance as deletePermanentInstanceDB,
  updateTemplateStats,
  getTemplateById,
  getAllTemplates,
} from '../../../core/services/storage/permanentTaskStorage';
import { saveTask } from '../../../core/services/storage/taskStorage';

/**
 * PERMANENT TASK ACTIONS
 * =======================
 * Business logic layer for permanent tasks.
 * Called by the universal task actions router (taskActions.ts).
 * Coordinates between factory and storage layers.
 * Enforces business rules like "templates cannot be completed".
 */

// ======== CREATE PERMANENT TASK ========

/**
 * CREATE PERMANENT TASK
 * ---------------------
 * Called by taskActions.createTask() when kind === 'permanent'
 * 
 * Handles TWO cases:
 * 1. Create instance from existing template (when templateId provided in additionalData)
 * 2. Create new template from scratch (when no templateId)
 * 
 * @param title - Task title
 * @param additionalData - Contains templateId (for instances) or template config (for new templates)
 * @returns Created task (template or instance) as Task type
 */
export async function createPermanentTask(
  title: string,
  additionalData?: Partial<Task>
): Promise<Task> {
  const data = additionalData as any;

  // CASE 1: Create instance from existing template
  if (data?.templateId) {
    const templateId = data.templateId;
    const template = await getTemplateById(templateId);

    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    if (!template.isTemplate) {
      throw new Error(`Task ${templateId} is not a template`);
    }

    // Create instance using factory
    const instance = createInstance({
      template,
      dueDate: data.dueDate instanceof Date ? data.dueDate.getTime() : data.dueDate,
      title: data.instanceTitle || title,
      location: data.location,
    });

    // Validate and save to template_instances table
    validateInstance(instance);
    await savePermanentInstance(instance);

    // Convert to Task type
    const task: Task = {
      id: instance.id,
      title: instance.title || instance.templateTitle,
      completed: instance.completed || false,
      createdAt: new Date(instance.createdAt),
      kind: 'permanent',
      dueDate: instance.dueDate ? new Date(instance.dueDate) : undefined,
      location: instance.location ? { name: instance.location } as any : undefined,
      metadata: {
        permanentId: instance.permanentId,
        templateTitle: instance.templateTitle,
        isTemplate: instance.isTemplate,
        autoRepeat: instance.autoRepeat,
      },
    };

    // Also save to tasks table so it shows up in getAllTasks()
    await saveTask(task);

    return task;
  }

  // CASE 2: Create new template from scratch
  const template = createTemplate({
    templateTitle: data?.templateTitle || title,
    location: data?.location,
    autoRepeat: data?.autoRepeat,
  });

  // Validate and save
  validateTemplate(template);
  await savePermanentTemplate(template);

  // Convert to Task type
  return {
    id: template.id,
    title: template.templateTitle,
    completed: false,
    createdAt: new Date(template.createdAt),
    kind: 'permanent',
    location: template.location ? { name: template.location } as any : undefined,
    metadata: {
      permanentId: template.permanentId,
      templateTitle: template.templateTitle,
      isTemplate: template.isTemplate,
      instanceCount: template.instanceCount,
      autoRepeat: template.autoRepeat,
    },
  } as Task;
}

// ======== COMPLETE PERMANENT TASK ========

/**
 * HANDLE PERMANENT COMPLETION
 * ----------------------------
 * Called by taskActions.completeTask() when task.kind === 'permanent'
 * 
 * Business Rules:
 * - Templates CANNOT be completed (they are definitions, not tasks)
 * - Only instances can be completed
 * - Completion updates template stats (streak, completion rate, etc.)
 * - May auto-create next recurring instance based on autoRepeat
 * 
 * @param task - The task to complete (must be an instance)
 * @returns Completed task as Task type
 */
export async function handlePermanentCompletion(task: Task): Promise<Task> {
  const metadata = task.metadata as any;

  // RULE: Templates cannot be completed
  if (metadata?.isTemplate) {
    throw new Error('Cannot complete a template. Create an instance first.');
  }

  // RULE: Only incomplete instances can be completed
  if (task.completed) {
    throw new Error('Task is already completed');
  }

  const completedAt = Date.now();

  // Build PermanentTask from Task
  const permanentTask: PermanentTask = {
    id: task.id,
    permanentId: metadata?.permanentId,
    templateTitle: metadata?.templateTitle || task.title,
    isTemplate: false,
    createdAt: task.createdAt.getTime(),
    completed: true,
    dueDate: task.dueDate?.getTime(),
    location: typeof task.location === 'object' ? (task.location as any).name : task.location,
    autoRepeat: metadata?.autoRepeat,
  };

  // Save the completed instance
  await savePermanentInstance(permanentTask);

  // Update template statistics
  await updateTemplateStats(
    permanentTask.permanentId,
    completedAt
  );

  // Auto-create next recurring instance if configured
  if (permanentTask.autoRepeat) {
    try {
      const template = await getTemplateById(permanentTask.permanentId);
      if (template) {
        const nextInstance = createNextRecurringInstance(
          template,
          permanentTask.dueDate
        );
        await savePermanentInstance(nextInstance);
      }
    } catch (error) {
      console.warn('Failed to create next recurring instance:', error);
      // Don't fail the completion if auto-repeat fails
    }
  }

  // Return as Task type
  return {
    ...task,
    completed: true,
  };
}

// ======== DELETE PERMANENT TASK ========

/**
 * DELETE PERMANENT TASK
 * ----------------------
 * Called by taskActions.deleteTask() when task.kind === 'permanent'
 * 
 * Business Rules:
 * - Deleting a TEMPLATE cascades to all its instances and stats (via DB foreign keys)
 * - Deleting an INSTANCE only removes that instance
 * - Deletion decrements template instanceCount
 * 
 * @param task - The task to delete
 */
export async function deletePermanentTask(task: Task): Promise<void> {
  const metadata = task.metadata as any;

  if (metadata?.isTemplate) {
    // Delete template (cascades to instances and stats via foreign keys)
    await deletePermanentTemplateDB(metadata.permanentId);
  } else {
    // Delete instance only
    await deletePermanentInstanceDB(
      task.id,
      metadata?.permanentId
    );
  }
}

// ======== REASSIGN PERMANENT TASK ========

/**
 * REASSIGN PERMANENT TASK
 * ------------------------
 * Called by taskActions.reassignTask() when task.kind === 'permanent'
 * 
 * Business Rules:
 * - Templates: Can update templateTitle, location, autoRepeat
 * - Instances: Can update title, dueDate, location
 * - Cannot change permanentId or isTemplate flag
 * 
 * @param task - The task to update
 * @param updates - Fields to update
 * @returns Updated task as Task type
 */
export async function reassignPermanentTask(
  task: Task,
  updates: Partial<Task>
): Promise<Task> {
  const metadata = task.metadata as any;

  // Build PermanentTask
  const permanentTask: PermanentTask = {
    id: task.id,
    permanentId: metadata?.permanentId,
    templateTitle: metadata?.templateTitle || task.title,
    isTemplate: metadata?.isTemplate || false,
    createdAt: task.createdAt.getTime(),
    completed: task.completed,
    dueDate: task.dueDate?.getTime(),
    location: typeof task.location === 'object' ? (task.location as any).name : task.location,
    title: task.title !== metadata?.templateTitle ? task.title : undefined,
    autoRepeat: metadata?.autoRepeat,
    instanceCount: metadata?.instanceCount,
  };

  // Apply updates
  const updatedPermanentTask: PermanentTask = {
    ...permanentTask,
    title: updates.title || permanentTask.title,
    dueDate: updates.dueDate ? updates.dueDate.getTime() : permanentTask.dueDate,
    location: typeof updates.location === 'object' ? (updates.location as any).name : updates.location || permanentTask.location,
  };

  // Validate based on type
  if (isTemplate(updatedPermanentTask)) {
    validateTemplate(updatedPermanentTask);
    await savePermanentTemplate(updatedPermanentTask);
  } else {
    validateInstance(updatedPermanentTask);
    await savePermanentInstance(updatedPermanentTask);
  }

  // Return as Task type
  return {
    ...task,
    ...updates,
  };
}

// ======== PUSH PERMANENT TASK FORWARD ========

/**
 * PUSH PERMANENT TASK FORWARD
 * ----------------------------
 * Called by taskActions.pushTaskForward() when task.kind === 'permanent'
 * 
 * Business Rules:
 * - Only instances can be pushed forward (templates have no due date)
 * - If no due date exists, sets to today + days
 * 
 * @param task - The task to push forward
 * @param days - Number of days to push forward (default: 1)
 * @returns Updated task as Task type
 */
export async function pushPermanentTaskForward(
  task: Task,
  days: number = 1
): Promise<Task> {
  const metadata = task.metadata as any;

  // RULE: Templates cannot be pushed forward
  if (metadata?.isTemplate) {
    throw new Error('Cannot push forward a template. Only instances have due dates.');
  }

  // Calculate new due date
  const currentDueDate = task.dueDate ? task.dueDate.getTime() : Date.now();
  const newDueDate = currentDueDate + (days * 86400000); // days * milliseconds per day

  // Build PermanentTask
  const permanentTask: PermanentTask = {
    id: task.id,
    permanentId: metadata?.permanentId,
    templateTitle: metadata?.templateTitle || task.title,
    isTemplate: false,
    createdAt: task.createdAt.getTime(),
    completed: task.completed,
    dueDate: newDueDate,
    location: typeof task.location === 'object' ? (task.location as any).name : task.location,
    title: task.title !== metadata?.templateTitle ? task.title : undefined,
    autoRepeat: metadata?.autoRepeat,
  };

  await savePermanentInstance(permanentTask);

  // Return as Task type
  return {
    ...task,
    dueDate: new Date(newDueDate),
  };
}

// ======== HELPER FUNCTIONS ========

/**
 * GET ALL TEMPLATES
 * -----------------
 * Retrieves all permanent task templates as Task objects.
 * Useful for UI to display available templates.
 * 
 * @returns Array of all templates as Task type
 */
export async function getAllPermanentTemplates(): Promise<Task[]> {
  const templates = await getAllTemplates();

  return templates.map(template => ({
    id: template.id,
    title: template.templateTitle,
    completed: false,
    createdAt: new Date(template.createdAt),
    kind: 'permanent' as const,
    location: template.location ? { name: template.location } as any : undefined,
    metadata: {
      permanentId: template.permanentId,
      templateTitle: template.templateTitle,
      isTemplate: template.isTemplate,
      instanceCount: template.instanceCount,
      autoRepeat: template.autoRepeat,
    },
  }));
}

/**
 * GET TEMPLATE BY ID
 * ------------------
 * Retrieves a specific template by its permanentId as Task object.
 * 
 * @param templateId - The template's permanentId
 * @returns The template as Task type, or null if not found
 */
export async function getPermanentTemplate(
  templateId: string
): Promise<Task | null> {
  const template = await getTemplateById(templateId);

  if (!template) {
    return null;
  }

  return {
    id: template.id,
    title: template.templateTitle,
    completed: false,
    createdAt: new Date(template.createdAt),
    kind: 'permanent',
    location: template.location ? { name: template.location } as any : undefined,
    metadata: {
      permanentId: template.permanentId,
      templateTitle: template.templateTitle,
      isTemplate: template.isTemplate,
      instanceCount: template.instanceCount,
      autoRepeat: template.autoRepeat,
    },
  };
}