import { db } from './database';
import { PermanentTask, TemplateStats } from '../../../features/permanentTask/types/permanentTask';

// ======== TEMPLATE OPERATIONS ========

/**
 * Save a permanent task template
 */
export async function savePermanentTemplate(template: PermanentTask): Promise<void> {
  db.runSync(
    `INSERT OR REPLACE INTO templates
      (permanentId, templateTitle, isTemplate, instanceCount, autoRepeat, location, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      template.permanentId,
      template.templateTitle,
      template.isTemplate ? 1 : 0,
      template.instanceCount || 0,
      template.autoRepeat ? JSON.stringify(template.autoRepeat) : null,
      template.location || null,
      template.createdAt,  // already number
    ]
  );

  // Initialize stats if missing
  db.runSync(
    `INSERT OR IGNORE INTO template_stats
      (templateId, completionCount, completionRate, currentStreak, maxStreak,
       completionMon, completionTue, completionWed, completionThu, completionFri,
       completionSat, completionSun, lastUpdatedAt)
     VALUES (?, 0, 0, 0, 0, 0,0,0,0,0,0,0, ?)`,
    [template.permanentId, Date.now()]
  );
}

/**
 * Get a template by its permanentId
 */
export async function getTemplateById(templateId: string): Promise<PermanentTask | null> {
  const rows = db.getAllSync<{
    permanentId: string;
    templateTitle: string;
    isTemplate: number;
    instanceCount: number;
    autoRepeat: string | null;
    location: string | null;
    createdAt: number;
  }>(`SELECT * FROM templates WHERE permanentId = ? AND isTemplate = 1`, [templateId]);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.permanentId,
    permanentId: row.permanentId,
    templateTitle: row.templateTitle,
    isTemplate: Boolean(row.isTemplate),
    instanceCount: row.instanceCount,
    autoRepeat: row.autoRepeat ? JSON.parse(row.autoRepeat) : undefined,
    location: row.location || undefined,
    createdAt: row.createdAt,
    completed: false,
  };
}

/**
 * Get all templates
 */
export async function getAllTemplates(): Promise<PermanentTask[]> {
  const rows = db.getAllSync<{
    permanentId: string;
    templateTitle: string;
    isTemplate: number;
    instanceCount: number;
    autoRepeat: string | null;
    location: string | null;
    createdAt: number;
  }>(`SELECT * FROM templates WHERE isTemplate = 1 ORDER BY createdAt DESC`);

  return rows.map(row => ({
    id: row.permanentId,
    permanentId: row.permanentId,
    templateTitle: row.templateTitle,
    isTemplate: Boolean(row.isTemplate),
    instanceCount: row.instanceCount,
    autoRepeat: row.autoRepeat ? JSON.parse(row.autoRepeat) : undefined,
    location: row.location || undefined,
    createdAt: row.createdAt,
    completed: false,
  }));
}

/**
 * Get template with its statistics
 */
export async function getTemplateWithStats(templateId: string): Promise<{
  template: PermanentTask;
  stats: TemplateStats;
} | null> {
  const template = await getTemplateById(templateId);
  if (!template) {
    return null;
  }

  const stats = await getTemplateStats(templateId);
  if (!stats) {
    return null;
  }

  return { template, stats };
}

/**
 * Delete a permanent task template and all its instances
 */
export async function deletePermanentTemplate(templateId: string): Promise<void> {
  db.runSync(`DELETE FROM template_instances WHERE templateId = ?`, [templateId]);
  db.runSync(`DELETE FROM templates WHERE permanentId = ?`, [templateId]);
  db.runSync(`DELETE FROM template_stats WHERE templateId = ?`, [templateId]);
}

// ======== INSTANCE OPERATIONS ========

/**
 * Save a permanent task instance
 */
export async function savePermanentInstance(instance: PermanentTask): Promise<void> {
  db.runSync(
    `INSERT OR REPLACE INTO template_instances
      (instanceId, templateId, createdAt)
     VALUES (?, ?, ?)`,
    [instance.id, instance.permanentId, instance.createdAt]
  );

  db.runSync(
    `UPDATE templates
       SET instanceCount = instanceCount + 1
     WHERE permanentId = ?`,
    [instance.permanentId]
  );
}

/**
 * Get all instances for a specific template
 */
export async function getInstancesByTemplateId(templateId: string): Promise<PermanentTask[]> {
  const rows = db.getAllSync<{
    instanceId: string;
    templateId: string;
    createdAt: number;
  }>(`SELECT * FROM template_instances WHERE templateId = ? ORDER BY createdAt DESC`, [templateId]);

  // Get the template to copy its data to instances
  const template = await getTemplateById(templateId);
  if (!template) {
    return [];
  }

  return rows.map(row => ({
    id: row.instanceId,
    permanentId: row.templateId,
    templateTitle: template.templateTitle,
    isTemplate: false,
    createdAt: row.createdAt,
    location: template.location,
    autoRepeat: template.autoRepeat,
    completed: false, // Note: completion status not stored in schema yet
  }));
}

/**
 * Get a specific instance by its ID
 */
export async function getInstanceById(instanceId: string): Promise<PermanentTask | null> {
  const rows = db.getAllSync<{
    instanceId: string;
    templateId: string;
    createdAt: number;
  }>(`SELECT * FROM template_instances WHERE instanceId = ?`, [instanceId]);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const template = await getTemplateById(row.templateId);
  if (!template) {
    return null;
  }

  return {
    id: row.instanceId,
    permanentId: row.templateId,
    templateTitle: template.templateTitle,
    isTemplate: false,
    createdAt: row.createdAt,
    location: template.location,
    autoRepeat: template.autoRepeat,
    completed: false,
  };
}

/**
 * Delete a single permanent task instance
 */
export async function deletePermanentInstance(instanceId: string, templateId: string): Promise<void> {
  db.runSync(
    `DELETE FROM template_instances WHERE instanceId = ? AND templateId = ?`,
    [instanceId, templateId]
  );

  db.runSync(
    `UPDATE templates
       SET instanceCount = instanceCount - 1
     WHERE permanentId = ? AND instanceCount > 0`,
    [templateId]
  );
}

// ======== STATS OPERATIONS ========

/**
 * Update stats when an instance is completed
 */
export async function updateTemplateStats(templateId: string, completedAt: number): Promise<void> {
  const rows = db.getAllSync<{ 
    completionCount: number,
    completionRate: number,
    currentStreak: number,
    maxStreak: number,
    completionMon: number,
    completionTue: number,
    completionWed: number,
    completionThu: number,
    completionFri: number,
    completionSat: number,
    completionSun: number
  }>(`SELECT * FROM template_stats WHERE templateId = ?`, [templateId]);

  let stats;
  if (rows.length === 0) {
    stats = {
      completionCount: 0,
      completionRate: 0,
      currentStreak: 0,
      maxStreak: 0,
      completionMon: 0,
      completionTue: 0,
      completionWed: 0,
      completionThu: 0,
      completionFri: 0,
      completionSat: 0,
      completionSun: 0
    };
  } else {
    stats = rows[0];
  }

  stats.completionCount += 1;
  stats.currentStreak += 1;
  if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;

  const day = new Date(completedAt).getDay();
  switch (day) {
    case 0: stats.completionSun += 1; break;
    case 1: stats.completionMon += 1; break;
    case 2: stats.completionTue += 1; break;
    case 3: stats.completionWed += 1; break;
    case 4: stats.completionThu += 1; break;
    case 5: stats.completionFri += 1; break;
    case 6: stats.completionSat += 1; break;
  }

  const instanceRows = db.getAllSync<{ instanceCount: number }>(
    `SELECT instanceCount FROM templates WHERE permanentId = ?`, [templateId]
  );
  const totalInstances = instanceRows.length ? instanceRows[0].instanceCount : 0;
  stats.completionRate = totalInstances > 0 ? stats.completionCount / totalInstances : 0;

  db.runSync(
    `INSERT OR REPLACE INTO template_stats
      (templateId, completionCount, completionRate, currentStreak, maxStreak,
       completionMon, completionTue, completionWed, completionThu, completionFri,
       completionSat, completionSun, lastUpdatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      templateId,
      stats.completionCount,
      stats.completionRate,
      stats.currentStreak,
      stats.maxStreak,
      stats.completionMon,
      stats.completionTue,
      stats.completionWed,
      stats.completionThu,
      stats.completionFri,
      stats.completionSat,
      stats.completionSun,
      Date.now()
    ]
  );
}

/**
 * Fetch stats for a template
 */
export async function getTemplateStats(templateId: string): Promise<TemplateStats | null> {
  const rows = db.getAllSync<TemplateStats>(`SELECT * FROM template_stats WHERE templateId = ?`, [templateId]);
  return rows.length ? rows[0] : null;
}