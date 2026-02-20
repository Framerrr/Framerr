/**
 * Grid Core - Library-Agnostic Layout Engine
 *
 * This module contains pure layout operations and types that are independent
 * of any specific grid library. All RGL-specific code is isolated in adapter/.
 *
 * PHASE 1 COMPLETE:
 * - types.ts     (LayoutModel, GridPolicy, ActivationState, events)
 * - ops.ts       (pure widget/layout operations)
 *
 * PHASE 3 COMPLETE:
 * - FramerrGridCore.tsx  (The unified grid component)
 * - history.ts           (Undo/redo management)
 * - gestures.ts          (Touch handling)
 */

// === TYPES ===
export type {
    // Layout types
    Breakpoint,
    LayoutItem,
    LayoutModel,
    MobileLayoutMode,
    // Policy types
    GridPolicy,
    GridPolicyExtensions,
    // State types
    ActivationState,
    // History types
    HistorySnapshot,
    HistoryStackName,
    UseLayoutHistoryReturn,
    // Event types
    LayoutEvent,
    GridEventHandlers,
    // Change detection types
    ChangeDetectionOptions,
    ChangeDetectionResult,
    // Constraint types
    WidgetConstraints,
    GetConstraintsFn,
} from './types';

// Re-export canonical widget types for convenience
export type { FramerrWidget, WidgetLayout, WidgetConfig } from './types';

// === OPERATIONS ===
export {
    // Widget CRUD
    addWidget,
    deleteWidget,
    // Widget modification
    updateWidgetConfig,
    resizeWidget,
    moveWidget,
    // Layout operations
    widgetsToLayoutItems,
    widgetsToLayoutModel,
    applyLayoutToWidgets,
    normalizeLayout,
    validateLayout,
    applyConstraintsToLayout,
    // Mobile layout
    deriveLinkedMobileLayout,
    snapshotToMobileLayout,
    // Change detection
    isDifferent,
    getChangedWidgetIds,
    widgetSetsMatch,
    // Utilities
    getWidgetById,
    generateWidgetId,
} from './ops';



// === PHASE 3: HISTORY ===
export { useLayoutHistory, MAX_HISTORY_SIZE } from './history';

// === PHASE 3: GESTURES ===
export {
    useTouchGestures,
    HOLD_THRESHOLD_MS,
    MOVE_THRESHOLD_PX,
    AUTO_RESET_MS,
} from './gestures';
export type { UseTouchGesturesReturn } from './gestures';

// === DND-KIT UTILITIES ===
// NOTE: dnd module was removed during GridStack migration.
// These utilities now live in src/shared/grid/adapter/ if needed.
export { DraggableWidget } from './DraggableWidget';
export type { DraggableWidgetProps } from './DraggableWidget';
