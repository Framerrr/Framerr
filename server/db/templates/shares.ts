/**
 * Template Sharing Operations
 * 
 * Share/unshare templates with users.
 */

import { getDb } from '../../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import type { ShareRow, TemplateShare } from '../templates.types';

// ============================================================================
// Sharing Operations
// ============================================================================

/**
 * Share a template with a user or everyone
 */
export async function shareTemplate(templateId: string, sharedWith: string): Promise<TemplateShare> {
    const id = uuidv4();

    try {
        const insert = getDb().prepare(`
            INSERT OR IGNORE INTO template_shares (id, template_id, shared_with)
            VALUES (?, ?, ?)
        `);

        insert.run(id, templateId, sharedWith);
        logger.debug(`[Templates] Shared: template=${templateId} with=${sharedWith}`);

        return {
            id,
            templateId,
            sharedWith,
            createdAt: new Date().toISOString(),
        };
    } catch (error) {
        logger.error(`[Templates] Failed to share: template=${templateId} with=${sharedWith} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Unshare a template
 * Also clears shared_from_id on user copies so they become "normal" templates
 */
export async function unshareTemplate(templateId: string, sharedWith: string): Promise<boolean> {
    try {
        // Delete the share permission
        const result = getDb().prepare('DELETE FROM template_shares WHERE template_id = ? AND shared_with = ?').run(templateId, sharedWith);

        // Also clear shared_from_id on user copies so they look like normal templates
        // This removes the "shared by" badge on the user's copy
        if (sharedWith === 'everyone') {
            // If sharing with everyone was revoked, clear all copies
            getDb().prepare('UPDATE dashboard_templates SET shared_from_id = NULL WHERE shared_from_id = ?').run(templateId);
            logger.debug(`[Templates] Cleared shared_from_id on all copies: template=${templateId}`);
        } else {
            // Clear shared_from_id only for the specific user's copy
            getDb().prepare('UPDATE dashboard_templates SET shared_from_id = NULL WHERE shared_from_id = ? AND owner_id = ?').run(templateId, sharedWith);
            logger.debug(`[Templates] Cleared shared_from_id on copy: template=${templateId} user=${sharedWith}`);
        }

        return result.changes > 0;
    } catch (error) {
        logger.error(`[Templates] Failed to unshare: template=${templateId} with=${sharedWith} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get shares for a template
 */
export async function getTemplateShares(templateId: string): Promise<TemplateShare[]> {
    try {
        const rows = getDb().prepare('SELECT * FROM template_shares WHERE template_id = ?').all(templateId) as ShareRow[];
        return rows.map(row => ({
            id: row.id,
            templateId: row.template_id,
            sharedWith: row.shared_with,
            createdAt: new Date(row.created_at * 1000).toISOString(),
        }));
    } catch (error) {
        logger.error(`[Templates] Failed to get shares: template=${templateId} error="${(error as Error).message}"`);
        throw error;
    }
}
