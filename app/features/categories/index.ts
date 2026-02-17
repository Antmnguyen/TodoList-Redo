// app/features/categories/index.ts
// =============================================================================
// CATEGORIES FEATURE - PUBLIC API
// =============================================================================
//
// Re-exports all public interfaces for the categories feature.
// Import from this file to use categories in other parts of the app.
//
// Usage:
//   import { useCategories, Category } from '../features/categories';
//
// =============================================================================

// Types
export { Category, CategoryStats, CategoryFactory, DEFAULT_CATEGORY_NAMES, DEFAULT_CATEGORY_COLORS } from './types/category';

// Hook
export { useCategories } from './hooks/useCategories';

// Actions (for advanced usage)
export {
  getAllCategories,
  getCategoryById,
  getCategoryByName,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats,
  getAllCategoryStats,
  getTaskCount,
  validateCategoryId,
} from './utils/categoryActions';
