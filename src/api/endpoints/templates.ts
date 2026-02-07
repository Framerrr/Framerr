/**
 * Templates API Endpoints
 * Template CRUD, categories, sharing, and dashboard backup/restore
 */
import { api } from '../client';
import { ApiResponse, UserId } from '../types';
import type { WidgetLayout } from './widgets';

// Types
export interface TemplateWidget {
    type: string;
    layout: WidgetLayout;
    config?: Record<string, unknown>;
    shareSensitiveConfig?: boolean;
    shareIntegration?: string;
    // Array per integration type to support multi-select (e.g., { sonarr: ['id1', 'id2'], plex: ['id3'] })
    shareIntegrations?: Record<string, string[]>;
}

export interface Template {
    id: string;
    name: string;
    description?: string;
    categoryId?: string; // Aligned with local Template type (no null)
    ownerId: UserId;
    widgets: TemplateWidget[];
    isDraft: boolean;
    isDefault?: boolean;
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: TemplateWidget[];
    createdAt: string;
    updatedAt: string;
    // Enriched fields from API
    categoryName?: string;
    ownerUsername?: string;
    sharedBy?: string;
    hasUpdate?: boolean;
    userModified?: boolean;
    sharedFromId?: string;
    shareCount?: number;
}

export interface Category {
    id: string;
    name: string;
}

export interface BackupData {
    widgets: unknown[];
    createdAt: string;
}

// Request/Response types
export interface TemplatesResponse {
    templates: Template[];
    categories: Category[];
}

export interface CategoriesResponse {
    categories: Category[];
}

export interface TemplateSharesResponse {
    users: { id: string; username: string }[];
    totalNonAdminUsers: number;
}

export interface CreateTemplateData {
    name: string;
    description?: string;
    categoryId?: string | null;
    widgets: TemplateWidget[];
    isDraft?: boolean;
    isDefault?: boolean;
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: TemplateWidget[];
}

export interface UpdateTemplateData {
    name?: string;
    description?: string;
    categoryId?: string | null;
    widgets?: TemplateWidget[];
    isDraft?: boolean;
    isDefault?: boolean;
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: TemplateWidget[];
}

export interface SaveDraftData {
    templateId?: string | null;
    name: string;
    description?: string;
    categoryId?: string | null;
    widgets: TemplateWidget[];
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: TemplateWidget[];
}

// Endpoints
export const templatesApi = {
    // ========== Template CRUD ==========

    /**
     * Get all templates with categories
     */
    getAll: () =>
        api.get<TemplatesResponse>('/api/templates'),

    /**
     * Get single template by ID
     */
    getById: (id: string) =>
        api.get<{ template: Template }>(`/api/templates/${id}`),

    /**
     * Create new template
     */
    create: (data: CreateTemplateData) =>
        api.post<{ template: Template }>('/api/templates', data),

    /**
     * Update existing template
     */
    update: (id: string, data: UpdateTemplateData) =>
        api.put<{ template: Template }>(`/api/templates/${id}`, data),

    /**
     * Delete template
     */
    delete: (id: string) =>
        api.delete<ApiResponse<void>>(`/api/templates/${id}`),

    // ========== Draft ==========

    /**
     * Save template as draft (auto-save during builder)
     */
    saveDraft: (data: SaveDraftData) =>
        api.post<{ template: { id: string } }>('/api/templates/draft', data),

    // ========== Actions ==========

    /**
     * Apply template to user's dashboard
     */
    apply: (id: string) =>
        api.post<ApiResponse<void>>(`/api/templates/${id}/apply`),

    /**
     * Sync shared template with parent (get latest version)
     */
    sync: (id: string) =>
        api.post<{ template: Template }>(`/api/templates/${id}/sync`),

    /**
     * Set template as default for new users (admin only)
     */
    setDefault: (id: string) =>
        api.post<ApiResponse<void>>(`/api/templates/${id}/set-default`),

    // ========== Categories ==========

    /**
     * Get all categories
     */
    getCategories: () =>
        api.get<CategoriesResponse>('/api/templates/categories'),

    /**
     * Create new category (admin only)
     */
    createCategory: (name: string) =>
        api.post<{ category: Category }>('/api/templates/categories', { name }),

    /**
     * Delete category (admin only)
     */
    deleteCategory: (id: string) =>
        api.delete<ApiResponse<void>>(`/api/templates/categories/${id}`),

    // ========== Backup/Restore ==========

    /**
     * Get current dashboard backup (created when template applied)
     */
    getBackup: () =>
        api.get<{ backup: BackupData | null }>('/api/templates/backup'),

    /**
     * Revert to previous dashboard from backup
     */
    revert: () =>
        api.post<ApiResponse<void>>('/api/templates/revert'),

    // ========== Sharing ==========

    /**
     * Get current shares for a template
     */
    getShares: (id: string) =>
        api.get<TemplateSharesResponse>(`/api/templates/${id}/shares`),

    /**
     * Share template with user or everyone
     */
    share: (id: string, sharedWith: string) =>
        api.post<ApiResponse<void>>(`/api/templates/${id}/share`, { sharedWith }),

    /**
     * Revoke share from user or everyone
     */
    unshare: (id: string, sharedWith: string) =>
        api.delete<ApiResponse<void>>(`/api/templates/${id}/share/${sharedWith}`),
};

export default templatesApi;
