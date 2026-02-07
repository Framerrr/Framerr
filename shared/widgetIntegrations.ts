/**
 * Widget Integration Mapping
 * 
 * CANONICAL source for widget type → integration name mapping.
 * Used by both frontend and backend to determine which integrations
 * are required for each widget type.
 * 
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH.
 * Do NOT hardcode these mappings elsewhere.
 */

/**
 * Map of widget type keys to their required integration(s).
 * - string: Single integration required
 * - string[]: Multiple integrations required (all needed)
 * - false: No integration required (standalone widget)
 */
export const WIDGET_INTEGRATION_MAP: Record<string, string | string[] | false> = {
    // System widgets (must match plugin.ts compatibleIntegrations)
    'system-status': ['glances', 'customsystemstatus'],
    'service-status': ['monitor', 'uptimekuma'],

    // Media widgets
    'plex': 'plex',
    'sonarr': 'sonarr',
    'radarr': 'radarr',
    'overseerr': 'overseerr',
    'calendar': ['sonarr', 'radarr'],  // Requires both

    // Download widgets
    'qbittorrent': 'qbittorrent',

    // Utility widgets (no integration required)
    'weather': false,
    'clock': false,
    'custom-html': false,
    'link-grid': false,
};

/**
 * Get all required integrations for a list of widget types.
 * Deduplicates and flattens the result.
 * 
 * @param widgetTypes - Array of widget type strings
 * @returns Array of unique integration names (excludes 'false' entries)
 */
export function getRequiredIntegrations(widgetTypes: string[]): string[] {
    const integrations = new Set<string>();

    for (const widgetType of widgetTypes) {
        const requirement = WIDGET_INTEGRATION_MAP[widgetType.toLowerCase()];

        if (requirement === false || requirement === undefined) {
            continue;
        }

        if (Array.isArray(requirement)) {
            requirement.forEach(i => integrations.add(i));
        } else {
            integrations.add(requirement);
        }
    }

    return Array.from(integrations);
}

/**
 * Get the integration name for a single widget type.
 * 
 * @param widgetType - Widget type string
 * @returns Integration name, array of names, or null if not required
 */
export function getWidgetIntegration(widgetType: string): string | string[] | null {
    const requirement = WIDGET_INTEGRATION_MAP[widgetType.toLowerCase()];

    if (requirement === false || requirement === undefined) {
        return null;
    }

    return requirement;
}

/**
 * Display names for integrations (for UI)
 */
export const INTEGRATION_DISPLAY_NAMES: Record<string, string> = {
    'plex': 'Plex',
    'sonarr': 'Sonarr',
    'radarr': 'Radarr',
    'overseerr': 'Overseerr',
    'qbittorrent': 'qBittorrent',
    'systemstatus': 'System Status',
};

/**
 * Get display name for an integration
 */
export function getIntegrationDisplayName(integrationName: string): string {
    return INTEGRATION_DISPLAY_NAMES[integrationName] || integrationName;
}

// ============================================================================
// Widget Sensitive Config
// ============================================================================

/**
 * Widget Sensitive Config Mapping
 * 
 * Defines which widgets have sensitive configuration that should be
 * stripped when sharing templates with other users.
 * 
 * - true: Entire config is sensitive (replaced with {})
 * - string[]: Only specified fields are sensitive (those fields removed)
 * 
 * Note: Widget-level display preferences (flatten, hideHeader) are NOT
 * part of config and will be preserved when sharing.
 */
export const WIDGET_SENSITIVE_CONFIG: Record<string, boolean | string[]> = {
    // User-created content widgets - entire config is personal
    'link-grid': true,      // All links are personal
    'custom-html': true,    // All custom HTML/CSS is personal
    // Note: Integration widgets (plex, sonarr, etc.) don't need handling here
    // because modern templates don't store credentials - only display settings
};

/**
 * Check if a widget type has sensitive config
 */
export function hasSensitiveConfig(widgetType: string): boolean {
    return widgetType.toLowerCase() in WIDGET_SENSITIVE_CONFIG;
}

/**
 * Strip sensitive config from a widget's config object.
 * Used when creating shared template copies.
 * 
 * @param widgetType - The widget type key
 * @param config - The widget's config object
 * @returns Sanitized config safe for sharing
 */
export function stripSensitiveConfig(
    widgetType: string,
    config: Record<string, unknown>
): Record<string, unknown> {
    const sensitivity = WIDGET_SENSITIVE_CONFIG[widgetType.toLowerCase()];

    // Not in sensitive map - return as-is
    if (sensitivity === undefined) {
        return config;
    }

    // Entire config is sensitive
    if (sensitivity === true) {
        return {};
    }

    // Per-field sensitivity - remove specified fields
    if (Array.isArray(sensitivity)) {
        const sanitized = { ...config };
        for (const field of sensitivity) {
            delete sanitized[field];
        }
        return sanitized;
    }

    return config;
}
