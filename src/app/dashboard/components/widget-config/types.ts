/**
 * Shared types for widget-config sub-components
 *
 * Extracted to avoid circular dependencies between the split files.
 */

/**
 * Subset of the useWidgetConfigUI return value needed by child components.
 * Using this type avoids tight coupling to the full hook return shape.
 */
export interface WidgetConfigUIState {
    showFlattenToggle: boolean;
    showHeaderToggle: boolean;
    headerToggleDisabled: boolean;
    headerDisabledReason?: string;
    isMultiIntegration: boolean;
    compatibleIntegrationTypes: string[];
    options: import('../../../../widgets/types').WidgetConfigOption[];
}

/**
 * Integration instance shape used across selector components.
 */
export interface IntegrationInstance {
    id: string;
    type: string;
    displayName: string;
    enabled: boolean;
}
