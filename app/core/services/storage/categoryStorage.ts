// app/core/services/storage/categoryStorage.ts
// =============================================================================
// CATEGORY STORAGE LAYER
// =============================================================================
//
// Handles all category-related database operations:
//   - CRUD operations for categories
//   - Statistics queries for Sprint 4
//
// Data Flow:
//   useCategories hook → categoryStorage → SQLite
//
// =============================================================================

import { db } from './database';
import { Category, CategoryStats, CategoryFactory } from '../../../features/categories/types/category';

// =============================================================================
// TYPE DEFINITIONS (SQL Row Shapes)
// =============================================================================

interface CategoryRow {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_default: number;
  created_at: number;
}

interface CountRow {
  count: number;
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get all categories from the database
 *
 * @returns Array of Category objects sorted by name
 */
export async function getAllCategories(): Promise<Category[]> {
  const rows = db.getAllSync<CategoryRow>(
    'SELECT * FROM categories ORDER BY is_default DESC, name ASC'
  );

  return rows.map(rowToCategory);
}

/**
 * Get a single category by ID
 *
 * @param categoryId - The category ID to look up
 * @returns Category object or null if not found
 */
export async function getCategoryById(categoryId: string): Promise<Category | null> {
  const rows = db.getAllSync<CategoryRow>(
    'SELECT * FROM categories WHERE id = ?',
    [categoryId]
  );

  if (rows.length === 0) return null;
  return rowToCategory(rows[0]);
}

/**
 * Get a category by name (case-insensitive)
 *
 * @param name - The category name to search
 * @returns Category object or null if not found
 */
export async function getCategoryByName(name: string): Promise<Category | null> {
  const rows = db.getAllSync<CategoryRow>(
    'SELECT * FROM categories WHERE LOWER(name) = LOWER(?)',
    [name]
  );

  if (rows.length === 0) return null;
  return rowToCategory(rows[0]);
}

/**
 * Create a new category
 *
 * @param name - Display name for the category
 * @param color - Optional hex color code
 * @param icon - Optional emoji or icon name
 * @returns The created Category object
 */
export async function createCategory(
  name: string,
  color?: string,
  icon?: string
): Promise<Category> {
  const category = CategoryFactory.create(name, color, icon);

  db.runSync(
    `INSERT INTO categories (id, name, color, icon, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      category.id,
      category.name,
      category.color || null,
      category.icon || null,
      category.isDefault ? 1 : 0,
      category.createdAt.getTime(),
    ]
  );

  return category;
}

/**
 * Update an existing category
 *
 * @param categoryId - The category ID to update
 * @param updates - Partial category object with fields to update
 */
export async function updateCategory(
  categoryId: string,
  updates: Partial<Pick<Category, 'name' | 'color' | 'icon'>>
): Promise<void> {
  const setClauses: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.color !== undefined) {
    setClauses.push('color = ?');
    values.push(updates.color || null);
  }
  if (updates.icon !== undefined) {
    setClauses.push('icon = ?');
    values.push(updates.icon || null);
  }

  if (setClauses.length === 0) return;

  values.push(categoryId);

  db.runSync(
    `UPDATE categories SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Delete a category
 *
 * NOTE: This does NOT delete tasks in the category.
 * Tasks will have their category_id set to NULL.
 *
 * @param categoryId - The category ID to delete
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  // Clear category_id from any tasks using this category
  db.runSync(
    'UPDATE tasks SET category_id = NULL WHERE category_id = ?',
    [categoryId]
  );

  // Clear category_id from permanent task tables
  db.runSync(
    'UPDATE templates SET category_id = NULL WHERE category_id = ?',
    [categoryId]
  );
  db.runSync(
    'UPDATE template_instances SET category_id = NULL WHERE category_id = ?',
    [categoryId]
  );

  // Then delete the category
  db.runSync('DELETE FROM categories WHERE id = ?', [categoryId]);
}

// =============================================================================
// STATISTICS QUERIES
// =============================================================================

/**
 * Get statistics for a specific category
 *
 * Computes stats from the tasks table for Sprint 4 visualization.
 *
 * @param categoryId - The category ID to get stats for
 * @returns CategoryStats object with computed statistics
 */
export async function getCategoryStats(categoryId: string): Promise<CategoryStats | null> {
  // Get category info
  const category = await getCategoryById(categoryId);
  if (!category) return null;

  // Get task counts
  const totalRow = db.getFirstSync<CountRow>(
    'SELECT COUNT(*) as count FROM tasks WHERE category_id = ?',
    [categoryId]
  );
  const completedRow = db.getFirstSync<CountRow>(
    'SELECT COUNT(*) as count FROM tasks WHERE category_id = ? AND completed = 1',
    [categoryId]
  );

  const totalTasks = totalRow?.count || 0;
  const completedTasks = completedRow?.count || 0;
  const activeTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get time-based counts (requires completed_at column - Sprint 4)
  // For now, return 0 - will be populated when completed_at is added
  const now = new Date();
  const startOfWeek = getStartOfWeek(now);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const weekRow = db.getFirstSync<CountRow>(
    `SELECT COUNT(*) as count FROM tasks
     WHERE category_id = ? AND completed = 1 AND completed_at >= ?`,
    [categoryId, startOfWeek.getTime()]
  );
  const monthRow = db.getFirstSync<CountRow>(
    `SELECT COUNT(*) as count FROM tasks
     WHERE category_id = ? AND completed = 1 AND completed_at >= ?`,
    [categoryId, startOfMonth.getTime()]
  );
  const yearRow = db.getFirstSync<CountRow>(
    `SELECT COUNT(*) as count FROM tasks
     WHERE category_id = ? AND completed = 1 AND completed_at >= ?`,
    [categoryId, startOfYear.getTime()]
  );

  return {
    categoryId,
    categoryName: category.name,
    totalTasks,
    completedTasks,
    activeTasks,
    completionRate,
    currentStreak: 0,  // TODO: Implement streak calculation in Sprint 4
    bestStreak: 0,     // TODO: Implement streak calculation in Sprint 4
    completedThisWeek: weekRow?.count || 0,
    completedThisMonth: monthRow?.count || 0,
    completedThisYear: yearRow?.count || 0,
  };
}

/**
 * Get statistics for all categories
 *
 * @returns Array of CategoryStats for all categories
 */
export async function getAllCategoryStats(): Promise<CategoryStats[]> {
  const categories = await getAllCategories();
  const statsPromises = categories.map(cat => getCategoryStats(cat.id));
  const results = await Promise.all(statsPromises);
  return results.filter((s): s is CategoryStats => s !== null);
}

/**
 * Get the number of tasks assigned to a category
 *
 * @param categoryId - The category ID
 * @returns Task count
 */
export async function getTaskCountForCategory(categoryId: string): Promise<number> {
  const row = db.getFirstSync<CountRow>(
    'SELECT COUNT(*) as count FROM tasks WHERE category_id = ?',
    [categoryId]
  );
  return row?.count || 0;
}

/**
 * Get all tasks belonging to a category
 *
 * Active tasks first, then completed, both sorted newest first.
 *
 * @param categoryId - The category ID
 * @returns Array of { id, title, completed } for each task
 */
export function getTasksForCategory(categoryId: string): { id: string; title: string; completed: boolean }[] {
  return db.getAllSync<{ id: string; title: string; completed: number }>(
    `SELECT id, title, completed FROM tasks
     WHERE category_id = ?
     ORDER BY completed ASC, created_at DESC`,
    [categoryId]
  ).map(row => ({ id: row.id, title: row.title, completed: row.completed === 1 }));
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert a database row to a Category object
 */
function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color || undefined,
    icon: row.icon || undefined,
    isDefault: row.is_default === 1,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Get the start of the current week (Monday)
 */
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
