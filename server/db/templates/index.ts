/**
 * Template Database Layer
 * 
 * Barrel export for all template-related database operations.
 * 
 * Handles CRUD operations for dashboard templates, categories, shares, and backups.
 */

// ============================================================================
// Re-export all functions from submodules
// ============================================================================

export * from './helpers';
export * from './crud';
export * from './categories';
export * from './shares';
export * from './backup';
export * from './apply';

// ============================================================================
// Re-export types for consumers
// ============================================================================

export type {
    TemplateWidget,
    DashboardTemplate,
    TemplateCategory,
    TemplateShare,
    DashboardBackup,
    CreateTemplateData,
    UpdateTemplateData,
    TemplateWithMeta,
    ShareTemplateOptions,
    ShareTemplateResult,
    DashboardWidget,
} from '../templates.types';
