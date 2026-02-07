/**
 * useDashboardLayout - Shared Layout Engine
 * 
 * This module exports the shared layout hook that powers both
 * Dashboard and Template Builder with identical logic.
 */

// Main hook
export { useDashboardLayout } from './useDashboardLayout';

// Types (re-export for consumers)
export type {
    FramerrWidget,
    WidgetLayout,
    MobileLayoutMode,
    Breakpoint,
    LayoutItem,
    LayoutState,
    UseDashboardLayoutOptions,
    UseDashboardLayoutReturn,
    GridPropsBundle,
    ChangeDetectionResult,
    WidgetBandInfo,
} from './types';

// Utility functions (for advanced use cases)
export {
    createLgLayoutItem,
    createSmLayoutItem,
    createLayoutsFromWidgets,
    getLayoutConstraints,
} from './layoutCreators';

export {
    checkForActualChanges,
} from './changeDetection';

export { widgetSetsMatch } from '../../shared/grid/core/ops';

export {
    getDisplayWidgets,
    getWidgetsToUse,
    sortWidgetsByY,
    applyBandDetection,
    createMobileSnapshot,
} from './mobileLayout';
