/**
 * useWidgetConfigUI - Centralized Widget Config UI State
 * 
 * Single source of truth for widget configuration UI decisions.
 * Reads constraints from plugin metadata and returns UI state
 * for all config-related toggles and selectors.
 * 
 * Consumers: WidgetConfigModal, WidgetCard, TemplateBuilderStep2
 */

import { useMemo } from 'react';
import {
    getWidgetMetadata,
    getWidgetConfigConstraints
} from '../../../widgets/registry';
import type { ConfigConstraints } from '../../../widgets/types';

// ============================================================================
// TYPES
// ============================================================================

export interface WidgetConfigUIState {
    // === TOGGLE VISIBILITY ===
    /** Show flatten toggle in config UI */
    showFlattenToggle: boolean;
    /** Show header toggle in config UI */
    showHeaderToggle: boolean;

    // === TOGGLE DISABLED STATES ===
    /** Header toggle is disabled (e.g., widget too short) */
    headerToggleDisabled: boolean;
    /** Reason why header is disabled (for tooltip) */
    headerDisabledReason: string | undefined;
    /** Whether toggling header also resizes the widget (hard mode) */
    headerTriggersResize: boolean;

    // === INTEGRATION UI ===
    /** Widget needs integration selector */
    showIntegrationSelector: boolean;
    /** Widget uses multiple integrations (like Calendar) */
    isMultiIntegration: boolean;
    /** List of compatible integration types */
    compatibleIntegrationTypes: string[];

    // === WIDGET OPTIONS ===
    /** Widget-specific options from plugin (for "Options" section) */
    options: import('../../../widgets/types').WidgetConfigOption[];

    // === RAW CONSTRAINTS (for advanced use) ===
    /** The raw constraints from the plugin */
    constraints: ConfigConstraints;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Get UI state for widget configuration based on plugin constraints.
 * 
 * @param widgetType - The widget type ID
 * @param widgetHeight - Current widget height (for height-based constraints)
 * @returns UI state decisions for config toggles and selectors
 * 
 * @example
 * ```tsx
 * const ui = useWidgetConfigUI('service-status', widget.h);
 * 
 * {ui.showFlattenToggle && <FlattenToggle />}
 * {ui.showHeaderToggle && (
 *   <HeaderToggle disabled={ui.headerToggleDisabled} />
 * )}
 * ```
 */
export function useWidgetConfigUI(
    widgetType: string,
    widgetHeight?: number
): WidgetConfigUIState {
    return useMemo(() => {
        const constraints = getWidgetConfigConstraints(widgetType);
        const metadata = getWidgetMetadata(widgetType);

        // Flatten toggle: shown unless explicitly disabled
        const showFlattenToggle = constraints.supportsFlatten !== false;

        // Header toggle visibility:
        // - Hidden if supportsHeader: false (widget doesn't support headers)
        // - Hidden if headerHeightMode: 'hard' (header controlled purely by height)
        // - Shown for soft mode (default) where user preference matters
        const isHardMode = constraints.headerHeightMode === 'hard';
        const showHeaderToggle = constraints.supportsHeader !== false && !isHardMode;

        // Header toggle is NEVER disabled in the new adaptive header system
        // Soft mode (default): toggle controls user preference, visibility is height-guarded
        const headerToggleDisabled = false;
        const headerDisabledReason: string | undefined = undefined;
        const headerTriggersResize = isHardMode;

        // Integration selector visibility
        const compatibleIntegrationTypes = metadata?.compatibleIntegrations || [];
        const showIntegrationSelector = compatibleIntegrationTypes.length > 0;
        const isMultiIntegration = metadata?.multiIntegration === true;

        // Widget-specific options from plugin
        const options = constraints.options || [];

        return {
            showFlattenToggle,
            showHeaderToggle,
            headerToggleDisabled,
            headerDisabledReason,
            headerTriggersResize,
            showIntegrationSelector,
            isMultiIntegration,
            compatibleIntegrationTypes,
            options,
            constraints,
        };
    }, [widgetType, widgetHeight]);
}

export default useWidgetConfigUI;
