/**
 * Widget Hooks - Barrel Export
 */

export { useWidgetData } from './useWidgetData';
export type { UseWidgetDataOptions, UseWidgetDataResult } from './useWidgetData';

export { useIntegrationFallback } from './useIntegrationFallback';
export type { IntegrationFallbackResult, AccessibleInstance } from './useIntegrationFallback';

export { useWidgetIntegration } from './useWidgetIntegration';
export type {
    UseWidgetIntegrationResult,
    WidgetIntegrationStatus,
    AccessibleIntegration
} from './useWidgetIntegration';

export { useMultiWidgetIntegration } from './useMultiWidgetIntegration';
export type {
    UseMultiWidgetIntegrationResult,
    MultiWidgetIntegrationStatus,
    ResolvedIntegration
} from './useMultiWidgetIntegration';

export { useIntegrationSSE } from './useIntegrationSSE';
export type { UseIntegrationSSEOptions, UseIntegrationSSEResult } from './useIntegrationSSE';

export { useMultiIntegrationSSE } from './useMultiIntegrationSSE';
export type { UseMultiIntegrationSSEOptions, UseMultiIntegrationSSEResult } from './useMultiIntegrationSSE';

export { useWidgetConfigUI } from './useWidgetConfigUI';
export type { WidgetConfigUIState } from './useWidgetConfigUI';

export { useAdaptiveHeader } from './useAdaptiveHeader';
export type { } from './useAdaptiveHeader';

