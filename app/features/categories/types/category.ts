// app/features/categories/types/category.ts
// =============================================================================
// CATEGORY TYPE DEFINITIONS
// =============================================================================
//
// Categories are reusable tags that can be assigned to one-off tasks.
// Each category tracks its own statistics for Sprint 4 visualization.
//
// =============================================================================

/**
 * Core Category interface
 *
 * Categories organize tasks and provide per-category statistics.
 * Default categories (Lifestyle, Work, Health) are seeded on first launch.
 */
export interface Category {
  // ===== CORE =====
  id: string;
  name: string;
  createdAt: Date;

  // ===== DISPLAY =====
  color?: string;  // Hex color for UI (e.g., "#007AFF")
  icon?: string;   // Emoji or icon name (e.g., "briefcase")

  // ===== FLAGS =====
  isDefault: boolean;  // True for seeded categories (Lifestyle, Work, Health)
}

/**
 * Statistics computed per category for Sprint 4
 *
 * These are NOT stored - they're computed from tasks table queries.
 * See categoryStorage.ts getCategoryStats()
 */
export interface CategoryStats {
  categoryId: string;
  categoryName: string;

  // ===== COUNTS =====
  totalTasks: number;       // All tasks with this category
  completedTasks: number;   // Tasks marked complete
  activeTasks: number;      // Uncompleted tasks

  // ===== PERCENTAGES =====
  completionRate: number;   // completedTasks / totalTasks (0-100)

  // ===== STREAKS (computed from completed_at timestamps) =====
  currentStreak: number;    // Consecutive days with completions
  bestStreak: number;       // Longest ever streak

  // ===== TIME-BASED COUNTS =====
  completedThisWeek: number;
  completedThisMonth: number;
  completedThisYear: number;
}

/**
 * Default category names (seeded on first launch)
 */
export const DEFAULT_CATEGORY_NAMES = ['Lifestyle', 'Work', 'Health'] as const;

/**
 * Default category colors (matching default names)
 */
export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  Lifestyle: '#34C759',  // Green
  Work: '#007AFF',       // Blue
  Health: '#FF9500',     // Orange
};

/**
 * Factory to create new Category objects
 */
export class CategoryFactory {
  /**
   * Generate unique ID for a category
   */
  static generateId(): string {
    return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new custom category
   */
  static create(name: string, color?: string, icon?: string): Category {
    return {
      id: this.generateId(),
      name,
      createdAt: new Date(),
      color,
      icon,
      isDefault: false,
    };
  }

  /**
   * Create a default category (used during seeding)
   */
  static createDefault(name: string): Category {
    return {
      id: this.generateId(),
      name,
      createdAt: new Date(),
      color: DEFAULT_CATEGORY_COLORS[name],
      isDefault: true,
    };
  }
}
