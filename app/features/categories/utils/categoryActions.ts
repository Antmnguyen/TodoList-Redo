// app/features/categories/utils/categoryActions.ts
// =============================================================================
// CATEGORY ACTIONS
// =============================================================================
//
// Business logic layer for categories.
// Coordinates between types and storage layers.
//
// Data Flow:
//   UI → useCategories hook → categoryActions → categoryStorage → SQLite
//
// =============================================================================

import { Category, CategoryStats, CategoryFactory } from '../types/category';
import {
  getAllCategories as getAllCategoriesFromStorage,
  getCategoryById as getCategoryByIdFromStorage,
  getCategoryByName as getCategoryByNameFromStorage,
  createCategory as createCategoryInStorage,
  updateCategory as updateCategoryInStorage,
  deleteCategory as deleteCategoryFromStorage,
  getCategoryStats as getCategoryStatsFromStorage,
  getAllCategoryStats as getAllCategoryStatsFromStorage,
  getTaskCountForCategory,
} from '../../../core/services/storage/categoryStorage';

// =============================================================================
// READ OPERATIONS
// =============================================================================

/**
 * Get all categories
 * Returns categories sorted by: defaults first, then alphabetically
 */
export async function getAllCategories(): Promise<Category[]> {
  return await getAllCategoriesFromStorage();
}

/**
 * Get category by ID
 */
export async function getCategoryById(categoryId: string): Promise<Category | null> {
  return await getCategoryByIdFromStorage(categoryId);
}

/**
 * Get category by name (case-insensitive)
 */
export async function getCategoryByName(name: string): Promise<Category | null> {
  return await getCategoryByNameFromStorage(name);
}

// =============================================================================
// WRITE OPERATIONS
// =============================================================================

/**
 * Create a new category
 *
 * Business Rules:
 * - Name must be unique (case-insensitive)
 * - Name cannot be empty
 *
 * @param name - Display name for the category
 * @param color - Optional hex color code
 * @param icon - Optional emoji or icon name
 * @returns The created Category object
 * @throws Error if name is empty or already exists
 */
export async function createCategory(
  name: string,
  color?: string,
  icon?: string
): Promise<Category> {
  // Validate name
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Category name cannot be empty');
  }

  // Check for duplicate
  const existing = await getCategoryByNameFromStorage(trimmedName);
  if (existing) {
    throw new Error(`Category "${trimmedName}" already exists`);
  }

  return await createCategoryInStorage(trimmedName, color, icon);
}

/**
 * Update an existing category
 *
 * Business Rules:
 * - Cannot change isDefault flag
 * - Name must remain unique if changed
 *
 * @param categoryId - The category ID to update
 * @param updates - Fields to update (name, color, icon)
 * @throws Error if name conflicts with existing category
 */
export async function updateCategory(
  categoryId: string,
  updates: Partial<Pick<Category, 'name' | 'color' | 'icon'>>
): Promise<void> {
  // If updating name, check for conflicts
  if (updates.name) {
    const trimmedName = updates.name.trim();
    if (!trimmedName) {
      throw new Error('Category name cannot be empty');
    }

    const existing = await getCategoryByNameFromStorage(trimmedName);
    if (existing && existing.id !== categoryId) {
      throw new Error(`Category "${trimmedName}" already exists`);
    }

    updates.name = trimmedName;
  }

  await updateCategoryInStorage(categoryId, updates);
}

/**
 * Delete a category
 *
 * Business Rules:
 * - Default categories CAN be deleted (user choice)
 * - Tasks using this category will have their category_id set to NULL
 *
 * @param categoryId - The category ID to delete
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  await deleteCategoryFromStorage(categoryId);
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get statistics for a specific category
 */
export async function getCategoryStats(categoryId: string): Promise<CategoryStats | null> {
  return await getCategoryStatsFromStorage(categoryId);
}

/**
 * Get statistics for all categories
 */
export async function getAllCategoryStats(): Promise<CategoryStats[]> {
  return await getAllCategoryStatsFromStorage();
}

/**
 * Get the number of tasks in a category
 */
export async function getTaskCount(categoryId: string): Promise<number> {
  return await getTaskCountForCategory(categoryId);
}

// =============================================================================
// TASK-CATEGORY ASSIGNMENT
// =============================================================================

/**
 * Validate that a category ID exists
 * Used before assigning a category to a task
 *
 * @param categoryId - The category ID to validate
 * @returns true if category exists, false otherwise
 */
export async function validateCategoryId(categoryId: string): Promise<boolean> {
  const category = await getCategoryByIdFromStorage(categoryId);
  return category !== null;
}
