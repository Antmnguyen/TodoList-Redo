// app/core/services/storage/schema/categories.ts
// =============================================================================
// CATEGORIES TABLE SCHEMA
// =============================================================================
//
// Creates the categories table and seeds default categories.
// Categories are reusable across one-off and permanent tasks.
//
// DEFAULT CATEGORIES:
//   - Lifestyle (green)
//   - Work (blue)
//   - Health (orange)
//
// =============================================================================

import { db } from '../database';
import { CategoryFactory, DEFAULT_CATEGORY_NAMES, DEFAULT_CATEGORY_COLORS } from '../../../../features/categories/types/category';

/**
 * Initialize the categories table schema
 *
 * Table Schema:
 * - id: TEXT PRIMARY KEY (cat_timestamp_random)
 * - name: TEXT NOT NULL (display name)
 * - color: TEXT (hex color code)
 * - icon: TEXT (emoji or icon name)
 * - is_default: INTEGER (1 = seeded default, 0 = user-created)
 * - created_at: INTEGER (timestamp)
 */
export function initializeCategoriesSchema(): void {
  // Create categories table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

  console.log('✅ Categories table created');

  // Seed default categories if table is empty
  seedDefaultCategories();
}

/**
 * Seed default categories on first launch
 *
 * Only inserts if the categories table is empty.
 * Creates: Lifestyle, Work, Health
 */
function seedDefaultCategories(): void {
  // Check if any categories exist
  const existingCount = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );

  if (existingCount && existingCount.count > 0) {
    console.log('📦 Categories already seeded, skipping');
    return;
  }

  // Insert default categories
  for (const name of DEFAULT_CATEGORY_NAMES) {
    const category = CategoryFactory.createDefault(name);

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
  }

  console.log('✅ Default categories seeded: Lifestyle, Work, Health');
}
