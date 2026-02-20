/**
 * Widget Registry - Auto-Discovery
 *
 * Auto-discovers all widget plugins using Vite's import.meta.glob.
 * Replaces manual widget registration in legacy widgetRegistry.ts.
 *
 * P4 Phase 4.5a: Auto-discovery implementation
 */

import type { LucideIcon } from 'lucide-react';
import { Activity } from 'lucide-react';
import type { WidgetPlugin, ConfigConstraints } from './types';
import type { WidgetCategory } from '../../shared/types/widget';
import logger from '../utils/logger';

// ============================================================================
// AUTO-DISCOVERY
// ============================================================================

// Eagerly import all plugin.ts files from widget folders
const pluginModules = import.meta.glob<{ plugin: WidgetPlugin }>(
    './**/plugin.ts',
    { eager: true }
);

// Build registry map from discovered plugins
const widgetPluginMap = new Map<string, WidgetPlugin>();
for (const [path, module] of Object.entries(pluginModules)) {
    // Skip _core folder
    if (path.includes('/_core/')) continue;

    const plugin = module.plugin;
    if (plugin?.id) {
        widgetPluginMap.set(plugin.id, plugin);
    }
}

// ============================================================================
// TYPES (matching legacy API)
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WidgetComponent = React.ComponentType<any>;

/**
 * Widget metadata interface (matches legacy WidgetMetadata)
 */
export interface WidgetMetadata {
    type?: string;
    component: WidgetComponent;
    icon: LucideIcon;
    name: string;
    description: string;
    category: WidgetCategory;
    defaultSize: { w: number; h: number };
    minSize?: { w?: number; h?: number };
    maxSize?: { w?: number; h?: number };
    compatibleIntegrations?: string[];
    multiIntegration?: boolean;
    integrationGroups?: Array<{ key: string; label: string; types: string[] }>;
    defaultConfig?: Record<string, unknown>;
    isGlobal?: boolean;
    configConstraints?: ConfigConstraints;
}

export type WidgetRegistry = Record<string, WidgetMetadata>;

export interface WidgetTypeInfo extends WidgetMetadata {
    type: string;
}

export type WidgetsByCategory = Record<string, WidgetTypeInfo[]>;

// ============================================================================
// WIDGET_TYPES (derived from plugins, for backwards compat)
// ============================================================================

function pluginToMetadata(plugin: WidgetPlugin): WidgetMetadata {
    return {
        component: plugin.component,
        icon: plugin.icon,
        name: plugin.name,
        description: plugin.description,
        category: plugin.category,
        defaultSize: plugin.sizing.default,
        minSize: plugin.sizing.min,
        maxSize: plugin.sizing.max,
        compatibleIntegrations: plugin.compatibleIntegrations,
        multiIntegration: plugin.multiIntegration,
        integrationGroups: plugin.integrationGroups,
        defaultConfig: plugin.defaultConfig,
        isGlobal: plugin.isGlobal,
        configConstraints: plugin.configConstraints,
    };
}

// Build WIDGET_TYPES object from plugins
export const WIDGET_TYPES: WidgetRegistry = Object.fromEntries(
    Array.from(widgetPluginMap.entries()).map(([id, plugin]) => [
        id,
        pluginToMetadata(plugin),
    ])
);

// ============================================================================
// HELPER FUNCTIONS (matching legacy API)
// ============================================================================

/**
 * Get widget component by type
 */
export function getWidgetComponent(type: string): WidgetComponent | null {
    const plugin = widgetPluginMap.get(type);
    return plugin?.component || null;
}

/**
 * Get widget icon by type
 */
export function getWidgetIcon(type: string): LucideIcon {
    const plugin = widgetPluginMap.get(type);
    return plugin?.icon || Activity;
}

/**
 * Get widget metadata by type
 */
export function getWidgetMetadata(type: string): WidgetMetadata | null {
    const plugin = widgetPluginMap.get(type);
    if (!plugin) return null;
    return pluginToMetadata(plugin);
}

/**
 * Get widget icon name (string) for IconPicker
 * Uses icon.displayName or falls back to 'Server'
 */
export function getWidgetIconName(type: string): string {
    const plugin = widgetPluginMap.get(type);
    if (!plugin?.icon) return 'Server';
    // LucideIcon components have displayName set
    return (plugin.icon as unknown as { displayName?: string }).displayName || 'Server';
}

// ============================================================================
// CONFIG CONSTRAINT HELPERS
// ============================================================================

/**
 * Get config constraints for a widget type.
 * Returns the plugin's constraints or defaults.
 */
export function getWidgetConfigConstraints(type: string): ConfigConstraints {
    const plugin = widgetPluginMap.get(type);
    return plugin?.configConstraints || {};
}

/**
 * Check if a widget supports header display.
 * Takes into account supportsHeader flag and height requirements.
 * 
 * Note: For runtime header visibility during resize, WidgetRenderer uses
 * useAdaptiveHeader hook which tracks container height via ResizeObserver.
 * This function is for static checks (e.g., initial config).
 * 
 * @param type - Widget type
 * @param currentHeight - Optional current height to check minHeightForHeader
 */
export function canWidgetShowHeader(type: string, currentHeight?: number): boolean {
    const constraints = getWidgetConfigConstraints(type);

    // Check if widget supports header at all
    if (constraints.supportsHeader === false) {
        return false;
    }

    // Check height requirement if specified and height provided
    const minHeight = constraints.minHeightForHeader;
    if (minHeight !== undefined && currentHeight !== undefined) {
        return currentHeight >= minHeight;
    }

    return true;
}

/**
 * Check if a widget supports flatten mode.
 */
export function canWidgetFlatten(type: string): boolean {
    const constraints = getWidgetConfigConstraints(type);
    return constraints.supportsFlatten !== false;
}

/**
 * Get the content padding for a widget type.
 * Returns 'md' as default if not specified.
 */
export function getWidgetContentPadding(type: string): 'none' | 'sm' | 'md' | 'lg' {
    const constraints = getWidgetConfigConstraints(type);
    return constraints.contentPadding || 'md';
}

// Category display order - system first, utility last
const CATEGORY_ORDER = ['system', 'media', 'downloads', 'utility', 'other'];

/**
 * Get all available widgets grouped by category
 * Returns categories in CATEGORY_ORDER
 */
export function getWidgetsByCategory(): WidgetsByCategory {
    const categories: WidgetsByCategory = {};

    for (const [type, plugin] of widgetPluginMap) {
        const category = plugin.category || 'other';
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push({
            type,
            ...pluginToMetadata(plugin),
        });
    }

    // Sort by CATEGORY_ORDER - unlisted categories go before 'other'
    const orderedCategories: WidgetsByCategory = {};
    for (const cat of CATEGORY_ORDER) {
        if (categories[cat]) {
            orderedCategories[cat] = categories[cat];
        }
    }
    // Add any unlisted categories before 'other' but after known ones
    for (const cat of Object.keys(categories)) {
        if (!CATEGORY_ORDER.includes(cat)) {
            orderedCategories[cat] = categories[cat];
        }
    }

    return orderedCategories;
}

// ============================================================================
// PREVIEW MODE (for template builder)
// ============================================================================

/**
 * All widgets now support preview mode via previewMode prop.
 * This is always true since P4 migration.
 */
export function supportsPreviewMode(type: string): boolean {
    return widgetPluginMap.has(type);
}

/**
 * Get the widget component for preview mode.
 * Returns the same component - widgets handle previewMode internally.
 */
export function getPreviewWidget(type: string): WidgetComponent | null {
    const plugin = widgetPluginMap.get(type);
    return plugin?.component || null;
}

// ============================================================================
// DEBUG / INTROSPECTION
// ============================================================================

/**
 * Get all registered widget IDs (for debugging)
 */
export function getAllWidgetTypes(): string[] {
    return Array.from(widgetPluginMap.keys());
}

/**
 * Check if a widget type exists in the registry
 */
export function isRegisteredWidgetType(type: string): boolean {
    return widgetPluginMap.has(type);
}

// ============================================================================
// WIDGET TYPE MIGRATIONS
// ============================================================================

/**
 * Map of old widget type IDs to new ones.
 * When a widget is renamed, add a mapping here so existing dashboards/templates
 * auto-migrate instead of losing the widget.
 * 
 * Example: { 'qbittorrent': 'downloads' }
 */
const WIDGET_TYPE_MIGRATIONS: Record<string, string> = {
    // Add future migrations here, e.g.:
    // 'old-widget-id': 'new-widget-id',
};

/**
 * Filter an array of widgets to only include types that exist in the registry.
 * Also applies type migrations (old name → new name) before filtering.
 * 
 * Use this at every API boundary where widgets are loaded from the server,
 * to guard against stale/renamed/removed widget types.
 * 
 * @param widgets - Array of widget objects with a `type` field
 * @param context - Description of where this is called (for logging)
 * @returns Filtered array with only registered widget types
 */
export function filterRegisteredWidgets<T extends { type: string }>(
    widgets: T[],
    context: string = 'unknown'
): T[] {
    if (!widgets || !Array.isArray(widgets)) return [];

    let migratedCount = 0;
    let removedCount = 0;

    const result = widgets
        .map(widget => {
            // Apply migration if old type has a mapping
            const migrated = WIDGET_TYPE_MIGRATIONS[widget.type];
            if (migrated) {
                migratedCount++;
                return { ...widget, type: migrated };
            }
            return widget;
        })
        .filter(widget => {
            if (widgetPluginMap.has(widget.type)) return true;
            removedCount++;
            return false;
        });

    if (migratedCount > 0 || removedCount > 0) {
        logger.warn(
            `[WidgetRegistry] ${context}: migrated=${migratedCount} removed=${removedCount} ` +
            `(${widgets.length} → ${result.length} widgets)`
        );
    }

    return result;
}

// ============================================================================
// SHARING HELPERS
// ============================================================================

/**
 * Check if a widget type is shareable (requires admin sharing).
 * Returns true for integration widgets, false for global utility widgets.
 */
export function isWidgetShareable(type: string): boolean {
    const plugin = widgetPluginMap.get(type);
    if (!plugin) return false;

    // Global widgets don't need sharing (utility widgets)
    if (plugin.isGlobal) return false;

    // Integration widgets need sharing
    return (plugin.compatibleIntegrations?.length ?? 0) > 0;
}

/**
 * Get all shareable widget types (integration widgets only).
 * Used by Shared Widgets Settings page.
 */
export function getShareableWidgets(): WidgetTypeInfo[] {
    const shareable: WidgetTypeInfo[] = [];

    for (const [type, plugin] of widgetPluginMap) {
        if (!plugin.isGlobal && (plugin.compatibleIntegrations?.length ?? 0) > 0) {
            shareable.push({
                type,
                ...pluginToMetadata(plugin),
            });
        }
    }

    return shareable;
}
