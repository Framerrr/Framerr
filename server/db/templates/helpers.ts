/**
 * Template Helpers
 * 
 * Row converters for transforming database rows to domain objects.
 */

import logger from '../../utils/logger';
import type {
    TemplateRow,
    CategoryRow,
    DashboardTemplate,
    TemplateCategory,
    TemplateWidget,
} from '../templates.types';

// ============================================================================
// Row Converters
// ============================================================================

/**
 * Convert a template database row to a DashboardTemplate object
 */
export function rowToTemplate(row: TemplateRow): DashboardTemplate {
    let widgets: TemplateWidget[] = [];
    try {
        widgets = JSON.parse(row.widgets);
    } catch {
        logger.warn(`[Templates] Failed to parse widgets: templateId=${row.id}`);
    }

    // Parse mobile widgets if present
    let mobileWidgets: TemplateWidget[] | null = null;
    if (row.mobile_widgets) {
        try {
            mobileWidgets = JSON.parse(row.mobile_widgets);
        } catch {
            logger.warn(`[Templates] Failed to parse mobile widgets: templateId=${row.id}`);
        }
    }

    return {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        description: row.description,
        categoryId: row.category_id,
        widgets,
        thumbnail: row.thumbnail,
        isDraft: row.is_draft === 1,
        isDefault: row.is_default === 1,
        sharedFromId: row.shared_from_id,
        userModified: row.user_modified === 1,
        version: row.version,
        createdAt: new Date(row.created_at * 1000).toISOString(),
        updatedAt: new Date(row.updated_at * 1000).toISOString(),
        // Mobile layout independence
        mobileLayoutMode: (row.mobile_layout_mode as 'linked' | 'independent') || 'linked',
        mobileWidgets,
    };
}

/**
 * Convert a category database row to a TemplateCategory object
 */
export function rowToCategory(row: CategoryRow): TemplateCategory {
    return {
        id: row.id,
        name: row.name,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at * 1000).toISOString(),
    };
}
