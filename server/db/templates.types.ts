/**
 * Template Types
 * 
 * Type definitions for dashboard templates, categories, shares, and backups.
 * Templates use FramerrWidget directly - same format as dashboard.
 */

import type { FramerrWidget } from '../../shared/types/widget';

// Re-export FramerrWidget as TemplateWidget for existing imports
// This allows gradual migration - eventually remove this alias
export type TemplateWidget = FramerrWidget;

export interface DashboardTemplate {
    id: string;
    ownerId: string;
    name: string;
    description: string | null;
    categoryId: string | null;
    widgets: TemplateWidget[];
    thumbnail: string | null;
    isDraft: boolean;
    isDefault: boolean;
    sharedFromId: string | null;
    userModified: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
    // Mobile layout independence
    mobileLayoutMode: 'linked' | 'independent';
    mobileWidgets: TemplateWidget[] | null;
}

export interface TemplateCategory {
    id: string;
    name: string;
    createdBy: string;
    createdAt: string;
}

export interface TemplateShare {
    id: string;
    templateId: string;
    sharedWith: string; // User ID or 'everyone'
    createdAt: string;
}

export interface DashboardBackup {
    id: string;
    userId: string;
    widgets: unknown[];
    mobileLayoutMode: 'linked' | 'independent';
    mobileWidgets: unknown[] | null;
    backedUpAt: string;
}

// ============================================================================
// Database Row Types (internal)
// ============================================================================

export interface TemplateRow {
    id: string;
    owner_id: string;
    name: string;
    description: string | null;
    category_id: string | null;
    widgets: string;
    thumbnail: string | null;
    is_draft: number;
    is_default: number;
    shared_from_id: string | null;
    user_modified: number;
    version: number;
    created_at: number;
    updated_at: number;
    // Mobile layout independence
    mobile_layout_mode: string | null;
    mobile_widgets: string | null;
}

export interface CategoryRow {
    id: string;
    name: string;
    created_by: string;
    created_at: number;
}

export interface ShareRow {
    id: string;
    template_id: string;
    shared_with: string;
    created_at: number;
}

export interface BackupRow {
    id: string;
    user_id: string;
    widgets: string;
    mobile_layout_mode: string;
    mobile_widgets: string | null;
    backed_up_at: number;
}

// ============================================================================
// Input/Output Types
// ============================================================================

export interface CreateTemplateData {
    ownerId: string;
    name: string;
    description?: string;
    categoryId?: string;
    widgets?: TemplateWidget[];
    thumbnail?: string;
    isDraft?: boolean;
    isDefault?: boolean;
    sharedFromId?: string;
    version?: number; // For shared copies, match parent version
    // Mobile layout independence
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: TemplateWidget[];
}

export interface UpdateTemplateData {
    name?: string;
    description?: string;
    categoryId?: string | null;
    widgets?: TemplateWidget[];
    thumbnail?: string | null;
    isDraft?: boolean;
    isDefault?: boolean;
    userModified?: boolean;
    // Mobile layout independence
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: TemplateWidget[] | null;
}

/**
 * Extended template with sharing metadata
 */
export interface TemplateWithMeta extends DashboardTemplate {
    sharedBy?: string;      // Username of original owner (for shared templates)
    hasUpdate?: boolean;    // Parent template has newer version
    originalVersion?: number; // Parent's current version for comparison
    shareCount?: number;    // Number of users this template is shared with (for admin)
}

export interface ShareTemplateOptions {
    /** Strip sensitive configs from widgets (default: true) */
    stripConfigs?: boolean;
    /** Share required integrations with user (default: false) */
    shareIntegrations?: boolean;
    /** Apply template to user's dashboard (default: false) */
    applyToDashboard?: boolean;
    /** Create backup before applying (default: true, ignored if applyToDashboard=false) */
    createBackup?: boolean;
}

export interface ShareTemplateResult {
    templateCopy: DashboardTemplate | null;
    integrationsShared: string[];
    skipped: boolean;
    reason?: string;
}

// ============================================================================
// Dashboard Widget Type (DEPRECATED)
// ============================================================================

/**
 * @deprecated Use FramerrWidget (TemplateWidget alias) instead.
 * This legacy format with root-level x/y/w/h and nested layouts is no longer used.
 * Templates and dashboards now share the unified FramerrWidget format.
 * This type is kept for reference only and should be removed in next major version.
 */
export interface DashboardWidget {
    i: string;
    id: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    layouts: {
        lg?: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        sm?: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
    };
    config: Record<string, unknown>;
}
