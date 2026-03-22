import { db } from './database';
import { PermanentTask, TemplateStats } from '../../../features/permanentTask/types/permanentTask';

// ======== TEMPLATE OPERATIONS ========

/**
 * Save a permanent task template
 */
export async function savePermanentTemplate(template: PermanentTask): Promise<void> {
  db.runSync(
    `INSERT OR REPLACE INTO templates
      (permanentId, templateTitle, isTemplate, instanceCount, autoRepeat, location, createdAt, category_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      template.permanentId,
      template.templateTitle,
      template.isTemplate ? 1 : 0,
      template.instanceCount || 0,
      template.autoRepeat ? JSON.stringify(template.autoRepeat) : null,
      template.location || null,
      template.createdAt,  // already number
      template.categoryId || null,
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
    category_id: string | null;
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
    categoryId: row.category_id || undefined,
  };
}

/**
 * Get all templates, including each template's category colour.
 *
 * The LEFT JOIN on categories denormalises `category_color` so that
 * UsePermanentTaskScreen can paint the category colour strip on each
 * template row without making a separate DB call per row.
 *
 * category_color is NULL when:
 *   - the template has no categoryId, OR
 *   - the referenced category has no colour set
 * In both cases the UI falls back to theme.categoryStripNone.
 */
export async function getAllTemplates(): Promise<PermanentTask[]> {
  const rows = db.getAllSync<{
    permanentId:    string;
    templateTitle:  string;
    isTemplate:     number;
    instanceCount:  number;
    autoRepeat:     string | null;
    location:       string | null;
    createdAt:      number;
    category_id:    string | null;
    category_color: string | null; // aliased from categories.color via LEFT JOIN
  }>(`
    SELECT t.permanentId, t.templateTitle, t.isTemplate, t.instanceCount,
           t.autoRepeat, t.location, t.createdAt, t.category_id,
           c.color AS category_color
    FROM   templates t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE  t.isTemplate = 1
    ORDER BY t.createdAt DESC
  `);

  return rows.map(row => ({
    id:            row.permanentId,
    permanentId:   row.permanentId,
    templateTitle: row.templateTitle,
    isTemplate:    Boolean(row.isTemplate),
    instanceCount: row.instanceCount,
    autoRepeat:    row.autoRepeat ? JSON.parse(row.autoRepeat) : undefined,
    location:      row.location || undefined,
    createdAt:     row.createdAt,
    completed:     false,
    categoryId:    row.category_id    || undefined,
    // Denormalised colour — passed straight through to the Task object so
    // UsePermanentTaskScreen doesn't need a second query to look it up.
    categoryColor: row.category_color || undefined,
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
 * Save a permanent task instance.
 *
 * Only writes the instance row — does NOT touch instanceCount on the parent
 * template.  instanceCount is incremented exclusively in updateTemplateStats()
 * (the completion path) so the counter reflects "times completed" rather than
 * "times created", fixing the double-count that occurred when this function
 * was called on both creation and completion.
 */
export async function savePermanentInstance(instance: PermanentTask): Promise<void> {
  db.runSync(
    `INSERT OR REPLACE INTO template_instances
      (instanceId, templateId, createdAt, dueDate, category_id)
     VALUES (?, ?, ?, ?, ?)`,
    [instance.id, instance.permanentId, instance.createdAt, instance.dueDate || null, instance.categoryId || null]
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
    dueDate: number | null;
    category_id: string | null;
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
    dueDate: row.dueDate || undefined,
    location: template.location,
    autoRepeat: template.autoRepeat,
    completed: false,
    categoryId: row.category_id || template.categoryId || undefined,
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
    dueDate: number | null;
    category_id: string | null;
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
    dueDate: row.dueDate || undefined,
    location: template.location,
    autoRepeat: template.autoRepeat,
    completed: false,
    categoryId: row.category_id || template.categoryId || undefined,
  };
}

/**
 * Update the due date of a permanent task instance.
 * Pass null to clear the due date.
 * Also updates the corresponding row in the tasks table to keep both in sync.
 */
export async function updateInstanceDueDate(instanceId: string, dueDate: number | null): Promise<void> {
  db.runSync(
    `UPDATE template_instances SET dueDate = ? WHERE instanceId = ?`,
    [dueDate, instanceId]
  );
  // Keep tasks table in sync
  db.runSync(
    `UPDATE tasks SET due_date = ? WHERE id = ?`,
    [dueDate, instanceId]
  );
}

/**
 * Read the due date of a single permanent task instance.
 * Returns null if the instance has no due date or doesn't exist.
 */
export async function getInstanceDueDate(instanceId: string): Promise<number | null> {
  const rows = db.getAllSync<{ dueDate: number | null }>(
    `SELECT dueDate FROM template_instances WHERE instanceId = ?`,
    [instanceId]
  );
  if (rows.length === 0 || rows[0].dueDate === null) {
    return null;
  }
  return rows[0].dueDate;
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

  // Increment instanceCount here — this is the sole place it is bumped so the
  // counter only ticks up on completion, not on creation.
  db.runSync(
    `UPDATE templates SET instanceCount = instanceCount + 1 WHERE permanentId = ?`,
    [templateId]
  );

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
 * Reverts the stats increments applied by updateTemplateStats() when a
 * permanent task instance is uncompleted (toggled back to incomplete).
 *
 * Rolls back:
 *   - templates.instanceCount  (decremented, floor 0)
 *   - template_stats.completionCount  (decremented, floor 0)
 *   - template_stats.currentStreak    (decremented, floor 0)
 *   - template_stats.completionRate   (recalculated from new counts)
 *
 * maxStreak is intentionally left unchanged — it records the historical high
 * and rolling it back on undo would be confusing / loss of real history.
 *
 * Day-of-week counters (completionMon … completionSun) are NOT rolled back
 * here because we don't store which day the completion was attributed to on
 * the Task object. The error is minor (one off-by-one on a weekday bucket)
 * and avoids a potentially wrong decrement on the wrong day.
 */
export function revertTemplateStats(templateId: string): void {
  // Decrement instanceCount on the template (floor 0).
  db.runSync(
    `UPDATE templates
        SET instanceCount = MAX(0, instanceCount - 1)
      WHERE permanentId = ?`,
    [templateId],
  );

  // Read current stats so we can recalculate completionRate.
  const rows = db.getAllSync<{ completionCount: number; currentStreak: number }>(
    `SELECT completionCount, currentStreak FROM template_stats WHERE templateId = ?`,
    [templateId],
  );
  if (rows.length === 0) return; // no stats row — nothing to revert

  const newCount  = Math.max(0, rows[0].completionCount - 1);
  const newStreak = Math.max(0, rows[0].currentStreak  - 1);

  // Fetch updated instanceCount for rate recalculation.
  const tmplRows = db.getAllSync<{ instanceCount: number }>(
    `SELECT instanceCount FROM templates WHERE permanentId = ?`,
    [templateId],
  );
  const totalInstances = tmplRows.length ? tmplRows[0].instanceCount : 0;
  const newRate = totalInstances > 0 ? newCount / totalInstances : 0;

  db.runSync(
    `UPDATE template_stats
        SET completionCount = ?,
            currentStreak   = ?,
            completionRate  = ?,
            lastUpdatedAt   = ?
      WHERE templateId = ?`,
    [newCount, newStreak, newRate, Date.now(), templateId],
  );
}

/**
 * Fetch stats for a template
 */
export async function getTemplateStats(templateId: string): Promise<TemplateStats | null> {
  const rows = db.getAllSync<TemplateStats>(`SELECT * FROM template_stats WHERE templateId = ?`, [templateId]);
  return rows.length ? rows[0] : null;
}

/**
 * Cascade a template category change to all its existing instances.
 *
 * MUST be called whenever templates.category_id changes.
 * Updates template_instances and tasks tables so pending instances
 * stay consistent with the template's new category.
 *
 * Does NOT touch completion_log — historical completions are immutable
 * and intentionally remain under the category they were completed in.
 */
export function updateTemplateCategoryInInstances(
  permanentId: string,
  newCategoryId: string | null
): void {
  db.runSync(
    `UPDATE template_instances SET category_id = ? WHERE templateId = ?`,
    [newCategoryId, permanentId]
  );
  db.runSync(
    `UPDATE tasks SET category_id = ?
      WHERE id IN (SELECT instanceId FROM template_instances WHERE templateId = ?)`,
    [newCategoryId, permanentId]
  );
}

/**
 * Returns a map from instanceId → template metadata for every row in
 * template_instances. Used by getAllTasks() to reconstruct `kind` and
 * `metadata` on tasks loaded from the DB, without N+1 queries.
 *
 * Mirrors the logic inside getInstanceById() but batched and synchronous.
 */
export function getAllInstanceMetaSync(): Map<string, {
  templateId:    string;
  templateTitle: string;
  autoRepeat:    any;
}> {
  const rows = db.getAllSync<{
    instanceId:    string;
    templateId:    string;
    templateTitle: string;
    autoRepeat:    string | null;
  }>(
    `SELECT ti.instanceId, ti.templateId, tmpl.templateTitle, tmpl.autoRepeat
     FROM template_instances ti
     JOIN templates tmpl ON tmpl.permanentId = ti.templateId`
  );

  return new Map(rows.map(r => [
    r.instanceId,
    {
      templateId:    r.templateId,
      templateTitle: r.templateTitle,
      autoRepeat:    r.autoRepeat ? JSON.parse(r.autoRepeat) : undefined,
    },
  ]));
}