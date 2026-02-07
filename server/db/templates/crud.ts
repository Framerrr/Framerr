/**
 * Template CRUD Operations
 * 
 * Core create, read, update, delete operations for dashboard templates.
 */

import { getDb } from '../../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { rowToTemplate } from './helpers';
import type {
    TemplateRow,
    DashboardTemplate,
    CreateTemplateData,
    UpdateTemplateData,
    TemplateWithMeta,
} from '../templates.types';

// ============================================================================
// Template CRUD Operations
// ============================================================================

/**
 * Create a new template
 */
export async function createTemplate(data: CreateTemplateData): Promise<DashboardTemplate> {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    try {
        const insert = getDb().prepare(`
            INSERT INTO dashboard_templates 
            (id, owner_id, name, description, category_id, widgets, thumbnail, is_draft, is_default, shared_from_id, version, created_at, updated_at, mobile_layout_mode, mobile_widgets)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insert.run(
            id,
            data.ownerId,
            data.name,
            data.description || null,
            data.categoryId || null,
            JSON.stringify(data.widgets || []),
            data.thumbnail || null,
            data.isDraft ? 1 : 0,
            data.isDefault ? 1 : 0,
            data.sharedFromId || null,
            data.version ?? 1, // Use provided version or default to 1
            now,
            now,
            data.mobileLayoutMode || 'linked',
            data.mobileWidgets ? JSON.stringify(data.mobileWidgets) : null
        );

        logger.debug(`[Templates] Created: id=${id} name="${data.name}" owner=${data.ownerId} version=${data.version ?? 1}`);

        return getTemplateById(id) as Promise<DashboardTemplate>;
    } catch (error) {
        logger.error(`[Templates] Failed to create: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get template by ID
 */
export async function getTemplateById(id: string): Promise<DashboardTemplate | null> {
    try {
        const row = getDb().prepare('SELECT * FROM dashboard_templates WHERE id = ?').get(id) as TemplateRow | undefined;
        return row ? rowToTemplate(row) : null;
    } catch (error) {
        logger.error(`[Templates] Failed to get: id=${id} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get all templates for a user (owned only - user copies of shared templates ARE owned)
 * Includes sharedBy and hasUpdate for templates that were shared
 */
export async function getTemplatesForUser(userId: string): Promise<TemplateWithMeta[]> {
    try {
        // Get all templates owned by this user
        // This now includes user copies of shared templates (they have sharedFromId)
        // For admin templates, count how many user copies exist (accurate share count)
        const query = `
            SELECT 
                t.*,
                parent.owner_id as parent_owner_id,
                parent.version as parent_version,
                u.username as parent_owner_username,
                (SELECT COUNT(*) FROM dashboard_templates WHERE shared_from_id = t.id) as share_count
            FROM dashboard_templates t
            LEFT JOIN dashboard_templates parent ON t.shared_from_id = parent.id
            LEFT JOIN users u ON parent.owner_id = u.id
            WHERE t.owner_id = ?
            ORDER BY t.is_draft DESC, t.name ASC
        `;

        interface ExtendedRow extends TemplateRow {
            parent_owner_id: string | null;
            parent_version: number | null;
            parent_owner_username: string | null;
            share_count: number;
        }

        const rows = getDb().prepare(query).all(userId) as ExtendedRow[];

        return rows.map(row => {
            const template = rowToTemplate(row);
            const meta: TemplateWithMeta = { ...template };

            // If this is a shared copy, add metadata
            if (row.shared_from_id && row.parent_owner_username) {
                meta.sharedBy = row.parent_owner_username;
                meta.hasUpdate = row.parent_version !== null && row.parent_version > row.version;
                meta.originalVersion = row.parent_version ?? undefined;
            }

            // For non-shared templates (admin's originals), show share count
            if (!row.shared_from_id && row.share_count > 0) {
                meta.shareCount = row.share_count;
            }

            return meta;
        });
    } catch (error) {
        logger.error(`[Templates] Failed to get for user: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get user's copy of a shared template (by sharedFromId)
 */
export async function getUserCopyOfTemplate(userId: string, originalTemplateId: string): Promise<DashboardTemplate | null> {
    try {
        const row = getDb().prepare(
            'SELECT * FROM dashboard_templates WHERE owner_id = ? AND shared_from_id = ?'
        ).get(userId, originalTemplateId) as TemplateRow | undefined;

        return row ? rowToTemplate(row) : null;
    } catch (error) {
        logger.error(`[Templates] Failed to get user copy: user=${userId} original=${originalTemplateId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get all users who have copies of a shared template
 * Used for displaying accurate share list in admin UI
 */
export async function getTemplateCopyOwners(templateId: string): Promise<Array<{ userId: string; username: string }>> {
    try {
        interface CopyOwnerRow {
            owner_id: string;
            username: string;
        }

        const rows = getDb().prepare(`
            SELECT t.owner_id, u.username
            FROM dashboard_templates t
            JOIN users u ON t.owner_id = u.id
            WHERE t.shared_from_id = ?
            ORDER BY u.username ASC
        `).all(templateId) as CopyOwnerRow[];

        return rows.map(row => ({
            userId: row.owner_id,
            username: row.username,
        }));
    } catch (error) {
        logger.error(`[Templates] Failed to get copy owners: template=${templateId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Update a template
 */
export async function updateTemplate(id: string, ownerId: string, data: UpdateTemplateData): Promise<DashboardTemplate | null> {
    try {
        // Verify ownership
        const existing = await getTemplateById(id);
        if (!existing || existing.ownerId !== ownerId) {
            return null;
        }

        const updates: string[] = [];
        const params: (string | number | null)[] = [];

        if (data.name !== undefined) {
            updates.push('name = ?');
            params.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.categoryId !== undefined) {
            updates.push('category_id = ?');
            params.push(data.categoryId);
        }
        if (data.widgets !== undefined) {
            updates.push('widgets = ?');
            params.push(JSON.stringify(data.widgets));
        }
        if (data.thumbnail !== undefined) {
            updates.push('thumbnail = ?');
            params.push(data.thumbnail);
        }
        if (data.isDraft !== undefined) {
            updates.push('is_draft = ?');
            params.push(data.isDraft ? 1 : 0);
        }
        if (data.isDefault !== undefined) {
            updates.push('is_default = ?');
            params.push(data.isDefault ? 1 : 0);
        }
        if (data.userModified !== undefined) {
            updates.push('user_modified = ?');
            params.push(data.userModified ? 1 : 0);
        }
        // Mobile layout independence
        if (data.mobileLayoutMode !== undefined) {
            updates.push('mobile_layout_mode = ?');
            params.push(data.mobileLayoutMode);
        }
        if (data.mobileWidgets !== undefined) {
            updates.push('mobile_widgets = ?');
            params.push(data.mobileWidgets ? JSON.stringify(data.mobileWidgets) : null);
        }

        // Increment version
        updates.push('version = version + 1');

        if (updates.length === 0) {
            return existing;
        }

        params.push(id);
        const updateQuery = `UPDATE dashboard_templates SET ${updates.join(', ')} WHERE id = ?`;
        getDb().prepare(updateQuery).run(...params);

        logger.debug(`[Templates] Updated: id=${id} fields=[${Object.keys(data).join(',')}]`);

        return getTemplateById(id);
    } catch (error) {
        logger.error(`[Templates] Failed to update: id=${id} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: string, ownerId: string): Promise<boolean> {
    try {
        const result = getDb().prepare('DELETE FROM dashboard_templates WHERE id = ? AND owner_id = ?').run(id, ownerId);

        if (result.changes > 0) {
            logger.debug(`[Templates] Deleted: id=${id} owner=${ownerId}`);
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`[Templates] Failed to delete: id=${id} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get the default template (for new users)
 */
export async function getDefaultTemplate(): Promise<DashboardTemplate | null> {
    try {
        const row = getDb().prepare('SELECT * FROM dashboard_templates WHERE is_default = 1 LIMIT 1').get() as TemplateRow | undefined;
        return row ? rowToTemplate(row) : null;
    } catch (error) {
        logger.error(`[Templates] Failed to get default: error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Set a template as default (clears other defaults)
 */
export async function setDefaultTemplate(id: string, ownerId: string): Promise<boolean> {
    try {
        // Verify ownership and admin status would be checked at route level
        const existing = await getTemplateById(id);
        if (!existing || existing.ownerId !== ownerId) {
            return false;
        }

        // Clear all defaults
        getDb().prepare('UPDATE dashboard_templates SET is_default = 0 WHERE is_default = 1').run();

        // Set new default
        getDb().prepare('UPDATE dashboard_templates SET is_default = 1 WHERE id = ?').run(id);

        logger.info(`[Templates] Default set: id=${id}`);
        return true;
    } catch (error) {
        logger.error(`[Templates] Failed to set default: id=${id} error="${(error as Error).message}"`);
        throw error;
    }
}
