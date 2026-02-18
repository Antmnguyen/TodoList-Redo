// app/features/categories/hooks/useCategories.ts
// =============================================================================
// CATEGORIES HOOK
// =============================================================================
//
// Provides category data and operations for UI components.
// Follows the same pattern as useTasks hook.
//
// Usage:
//   const { categories, loading, addCategory, removeCategory } = useCategories();
//
// =============================================================================

import { useState, useEffect } from 'react';
import { Category, CategoryStats } from '../types/category';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats,
  getAllCategoryStats,
} from '../utils/categoryActions';

export function useCategories() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Load categories on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const loaded = await getAllCategories();
      setCategories(loaded);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------
  async function addCategory(name: string, color?: string, icon?: string) {
    const category = await createCategory(name, color, icon);

    // Optimistic insert
    setCategories(prev => [...prev, category]);

    return category;
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------
  async function editCategory(
    categoryId: string,
    updates: Partial<Pick<Category, 'name' | 'color' | 'icon'>>
  ) {
    await updateCategory(categoryId, updates);

    // Update local state
    setCategories(prev =>
      prev.map(cat =>
        cat.id === categoryId ? { ...cat, ...updates } : cat
      )
    );
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  async function removeCategory(categoryId: string) {
    // Optimistic removal
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));

    await deleteCategory(categoryId);
  }

  // ---------------------------------------------------------------------------
  // STATS (for Sprint 4)
  // ---------------------------------------------------------------------------
  async function getStats(categoryId: string): Promise<CategoryStats | null> {
    return await getCategoryStats(categoryId);
  }

  async function getAllStats(): Promise<CategoryStats[]> {
    return await getAllCategoryStats();
  }

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    categories,
    loading,
    addCategory,
    editCategory,
    removeCategory,
    getStats,
    getAllStats,
    reload: loadCategories,
  };
}
