/**
 * Form Registry - Maps integration type IDs to their form components
 * 
 * This is separate from definitions.ts to avoid circular dependencies.
 * Simple integrations use StandardIntegrationForm (auto-generated from fields).
 * Complex integrations register their own form components here.
 * 
 * The form components are referenced by ID, and ServiceSettingsGrid
 * handles rendering them with appropriate props.
 */

// ============================================================================
// Form Registry - Just IDs, no imports to avoid circular deps
// ============================================================================

/**
 * IDs of integrations that have custom form components
 * (not using StandardIntegrationForm)
 * 
 * Note: glances and customsystemstatus use StandardIntegrationForm with infoMessage
 */
export const CUSTOM_FORM_TYPES = new Set([
    'plex',
    'jellyfin',    // Custom form with Library Sync UI
    'emby',        // Custom form with Library Sync UI
    'monitor',     // In-house service monitoring (extracted from ServiceMonitoringForm)
    'uptimekuma'   // Uptime Kuma connection (adapted from UptimeKumaTab)
]);

/**
 * Check if an integration type has a custom form component
 */
export const hasCustomForm = (typeId: string): boolean => {
    return CUSTOM_FORM_TYPES.has(typeId);
};
