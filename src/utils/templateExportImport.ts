/**
 * Template Export/Import Utilities
 * 
 * Handles .framerr file format for template export/import
 */

import { stripSensitiveConfig, hasSensitiveConfig } from '../../shared/widgetIntegrations';

// ============================================================================
// Types
// ============================================================================

export interface TemplateWidget {
    type: string;
    layout: { x: number; y: number; w: number; h: number };
    mobileLayout?: { x: number; y: number; w: number; h: number };
    config?: Record<string, unknown>;
    shareSensitiveConfig?: boolean;
}

export interface ExportedTemplate {
    version: 1;
    exportedAt: string;
    exportedFrom: 'Framerr';
    template: {
        name: string;
        description: string | null;
        widgets: TemplateWidget[];
        mobileLayoutMode: 'linked' | 'independent';
        mobileWidgets: TemplateWidget[] | null;
    };
}

// Template type (matching existing Template interface)
export interface Template {
    id: string;
    name: string;
    description?: string;
    widgets: TemplateWidget[];
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: TemplateWidget[] | null;
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Process widgets for export, optionally stripping sensitive configs
 */
function processWidgetsForExport(widgets: TemplateWidget[], includeConfigs: boolean): TemplateWidget[] {
    return widgets.map(widget => {
        const processed: TemplateWidget = {
            type: widget.type,
            layout: { ...widget.layout },
        };

        // Include mobileLayout if present (independent mode widgets)
        if (widget.mobileLayout) {
            processed.mobileLayout = { ...widget.mobileLayout };
        }

        if (widget.config) {
            if (includeConfigs || !hasSensitiveConfig(widget.type)) {
                // Include config as-is
                processed.config = { ...widget.config };
            } else {
                // Strip sensitive config
                processed.config = stripSensitiveConfig(widget.type, widget.config);
            }
        }

        return processed;
    });
}

/**
 * Export a template as a .framerr file download
 */
export function exportTemplate(template: Template, includeConfigs: boolean): void {
    const exportData: ExportedTemplate = {
        version: 1,
        exportedAt: new Date().toISOString(),
        exportedFrom: 'Framerr',
        template: {
            name: template.name,
            description: template.description || null,
            widgets: processWidgetsForExport(template.widgets, includeConfigs),
            mobileLayoutMode: template.mobileLayoutMode || 'linked',
            mobileWidgets: template.mobileWidgets
                ? processWidgetsForExport(template.mobileWidgets, includeConfigs)
                : null,
        },
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(template.name)}.framerr`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Sanitize filename for safe file system use
 */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
        .replace(/\s+/g, '-')          // Spaces to dashes
        .substring(0, 100);            // Limit length
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Read and parse a .framerr file
 */
export async function readFramerrFile(file: File): Promise<ExportedTemplate> {
    const text = await file.text();
    const data = JSON.parse(text);

    const validated = validateTemplate(data);
    if (!validated) {
        throw new Error('Invalid template file format');
    }

    return validated;
}

/**
 * Validate imported template data structure
 */
export function validateTemplate(data: unknown): ExportedTemplate | null {
    if (!data || typeof data !== 'object') return null;

    const obj = data as Record<string, unknown>;

    // Check version
    if (obj.version !== 1) return null;

    // Check template object
    if (!obj.template || typeof obj.template !== 'object') return null;

    const template = obj.template as Record<string, unknown>;

    // Required fields
    if (typeof template.name !== 'string') return null;
    if (!Array.isArray(template.widgets)) return null;

    // Validate widgets have required structure
    for (const widget of template.widgets) {
        if (!widget || typeof widget !== 'object') return null;
        const w = widget as Record<string, unknown>;
        if (typeof w.type !== 'string') return null;
        if (!w.layout || typeof w.layout !== 'object') return null;
    }

    return data as ExportedTemplate;
}

/**
 * Check if a template has any widgets with sensitive config
 */
export function templateHasSensitiveWidgets(widgets: TemplateWidget[]): boolean {
    return widgets.some(w => hasSensitiveConfig(w.type));
}
