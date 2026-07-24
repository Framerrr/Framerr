/**
 * Shared Widget Components - Barrel Export
 * 
 * Unified widget primitives for consistent rendering across:
 * - Dashboard
 * - Template Builder
 * - Widget Gallery
 * - Add Widget Modal
 */

// Components
export { WidgetCard } from './WidgetCard';
export { WidgetRenderer } from './WidgetRenderer';
export { WidgetStateMessage } from './WidgetStateMessage';
export { PartialErrorBadge } from './components/PartialErrorBadge';
export type { PartialErrorBadgeProps, ErroredInstance } from './components/PartialErrorBadge';

// Types
export type { WidgetCardProps, WidgetCardVariant } from './WidgetCard.types';
export type { WidgetRendererProps, WidgetRenderMode, WidgetPaddingSize } from './WidgetRenderer.types';
export type { WidgetStateMessageProps, WidgetStateVariant } from './WidgetStateMessage';

// Hooks
export { useWidgetData, useIntegrationFallback, useWidgetIntegration, useMultiWidgetIntegration, useIntegrationSSE, useMultiIntegrationSSE, useWidgetConfigUI } from './hooks';
export type {
    UseWidgetDataResult,
    IntegrationFallbackResult,
    UseWidgetIntegrationResult,
    WidgetIntegrationStatus,
    AccessibleIntegration,
    UseMultiWidgetIntegrationResult,
    MultiWidgetIntegrationStatus,
    ResolvedIntegration,
    UseIntegrationSSEOptions,
    UseIntegrationSSEResult,
    UseMultiIntegrationSSEOptions,
    UseMultiIntegrationSSEResult,
    WidgetConfigUIState
} from './hooks';

// Chrome identity
export { resolveWidgetChrome } from './resolveWidgetChrome';
export type {
    ResolveWidgetChromeInput,
    ResolvedWidgetChrome,
    ChromeIntegrationRef,
    ChromeSchemaRef,
} from './resolveWidgetChrome';

