/**
 * Template Category Operations
 * 
 * CRUD operations for template categories.
 */

import { getDb } from '../../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { rowToCategory } from './helpers';
import type { CategoryRow, TemplateCategory } from '../templates.types';

// ============================================================================
// Category Operations
// ============================================================================

/**
 * Get all categories
 */
export async function getCategories(): Promise<TemplateCategory[]> {
    try {
        const rows = getDb().prepare('SELECT * FROM template_categories ORDER BY name ASC').all() as CategoryRow[];
        return rows.map(rowToCategory);
    } catch (error) {
        logger.error(`[Templates] Failed to get categories: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Create a category (admin only - checked at route level)
 */
export async function createCategory(name: string, createdBy: string): Promise<TemplateCategory> {
    const id = uuidv4();

    try {
        const insert = getDb().prepare(`
            INSERT INTO template_categories (id, name, created_by)
            VALUES (?, ?, ?)
        `);

        insert.run(id, name, createdBy);
        logger.debug(`[Templates] Category created: id=${id} name="${name}" by=${createdBy}`);

        const row = getDb().prepare('SELECT * FROM template_categories WHERE id = ?').get(id) as CategoryRow;
        return rowToCategory(row);
    } catch (error) {
        logger.error(`[Templates] Failed to create category: name="${name}" error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Delete a category (moves templates to uncategorized)
 */
export async function deleteCategory(id: string): Promise<boolean> {
    try {
        // Templates will have category_id set to NULL due to ON DELETE SET NULL
        const result = getDb().prepare('DELETE FROM template_categories WHERE id = ?').run(id);

        if (result.changes > 0) {
            logger.debug(`[Templates] Category deleted: id=${id}`);
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`[Templates] Failed to delete category: id=${id} error="${(error as Error).message}"`);
        throw error;
    }
}
