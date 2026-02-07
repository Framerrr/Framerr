/**
 * Type definitions for the templates feature
 */

// Re-export Template type from TemplateCard (will be centralized in future)
export type { Template } from './components/TemplateCard';

/**
 * Props for TemplateSettings component
 */
export interface TemplateSettingsProps {
    className?: string;
}

/**
 * Widget data structure for template operations
 */
export interface WidgetData {
    i: string;
    type: string;
    layouts?: {
        lg?: { x: number; y: number; w: number; h: number };
        sm?: { x: number; y: number; w: number; h: number };
    };
    config?: Record<string, unknown>;
}

/**
 * Backup data structure for dashboard revert functionality
 */
export interface BackupData {
    widgets: WidgetData[];
    mobileLayoutMode: string;
    createdAt: string;
}

/**
 * Builder mode for template creation/editing
 */
export type BuilderMode = 'create' | 'save-current' | 'edit' | 'duplicate' | 'import';
