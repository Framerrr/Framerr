/**
 * Grid Core Types - Library-Agnostic Type Contracts
 *
 * CANONICAL DEFINITIONS: These types are the single source of truth
 * for the Framerr grid system. All code must use these interfaces.
 *
 * ARCHITECTURE REFERENCE: docs/grid-rework/ARCHITECTURE.md Lines 115-402
 *
 * Key principles:
 * - FramerrWidget[] is the persisted shape (saved to database)
 * - LayoutModel is DERIVED and TRANSIENT (never persisted)
 * - GridPolicy is the canonical configuration shape
 * - RGL types are INTERNAL to adapter/ only
 */

// Re-export canonical widget types from shared
export type { FramerrWidget, WidgetLayout, WidgetConfig } from '../../../../shared/types/widget';

// Import for internal use
import type { FramerrWidget } from '../../../../shared/types/widget';

// ============================================================================
// LAYOUT TYPES (DERIVED, TRANSIENT)
// ============================================================================

/**
 * Breakpoint identifiers for responsive grid.
 * 'lg' = desktop (12 columns), 'sm' = mobile (2 columns)
 */
export type Breakpoint = 'lg' | 'sm';

/**
 * LayoutItem represents a single widget's position in the grid.
 * Used internally by Core and Adapter.
 *
 * NOTE: Uses `id` (not `i` like RGL). Adapter converts id ↔ i at boundary.
 */
export interface LayoutItem {
    /** Widget ID (matches FramerrWidget.id) */
    id: string;
    /** X position in grid units */
    x: number;
    /** Y position in grid units */
    y: number;
    /** Width in grid units */
    w: number;
    /** Height in grid units */
    h: number;
    // Constraints (computed from plugin registry)
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
    // Behavioral flags
    locked?: boolean;
    static?: boolean;
}

/**
 * LayoutModel is TRANSIENT - derived from FramerrWidget[] at render time.
 * Core computes this to pass to Adapter. Never saved to database.
 *
 * @important DO NOT persist LayoutModel directly - always persist widgets.
 */
export interface LayoutModel {
    /** Desktop layout items */
    desktop: LayoutItem[];
    /** Mobile layout items (only present if mobileLayoutMode === 'independent') */
    mobile?: LayoutItem[];
}

/**
 * Mobile layout mode - determines whether mobile layout is synchronized with desktop
 */
export type MobileLayoutMode = 'linked' | 'independent';

// ============================================================================
// GRID POLICY (CANONICAL VERSION)
// ============================================================================

/**
 * GridPolicy - Canonical configuration for grid behavior.
 * This is the single source of truth for policy shape.
 *
 * Wrappers create policies, Core uses them to configure the grid.
 */
export interface GridPolicy {
    // === LAYOUT (adapter-forwarded) ===
    layout: {
        /** true = use WidthProvider (responsive), false = fixed width */
        responsive: boolean;
        /** Required if responsive=false */
        width?: number;
        /** Breakpoint thresholds (optional, uses defaults if not provided) */
        breakpoints?: Record<string, number>;
        /** Column counts per breakpoint */
        cols: Record<string, number>;
        /** Row height in pixels */
        rowHeight: number | 'auto';
        /** Margin between items [horizontal, vertical] */
        margin: [number, number];
        /** Container padding [horizontal, vertical] */
        containerPadding?: [number, number];
        /** Compaction strategy */
        compactType: 'vertical' | 'horizontal' | null;
        /** Prevent overlapping items */
        preventCollision: boolean;
        /** Scale transform for previews (Template Builder) */
        transformScale?: number;
        /** Maximum number of rows the grid can expand to */
        maxRows?: number;
    };

    // === INTERACTION (Core-gated, adapter-forwarded) ===
    interaction: {
        /** Enable drag */
        canDrag: boolean;
        /** Enable resize */
        canResize: boolean;
        /** Which resize handles to show */
        resizeHandles: Array<'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw'>;
        /** CSS selector for elements that cancel drag (e.g., buttons) */
        draggableCancel: string;
        /** Keep items within container bounds */
        isBounded: boolean;
        /** Touch blocking is active (mobile hold-to-drag) - when true, requires dragReadyWidgetId */
        touchBlockingActive?: boolean;
    };

    // === BEHAVIOR (Core-owned) ===
    behavior: {
        /** When to push to history: 'on-stop' or 'on-change' */
        commitStrategy: 'on-stop' | 'on-change';
        /** Selection mode */
        selectionMode: 'single' | 'none';
        /** Mobile unlock pattern */
        touchActivation: 'long-press' | 'none';
        /** Enable auto-scroll during drag */
        autoScroll: boolean;
        /** Container ID for auto-scroll (default: 'dashboard-layer') */
        autoScrollContainerId?: string;
        /** Edge threshold in pixels for auto-scroll (default: 200) */
        autoScrollEdgeThreshold?: number;
    };

    // === VIEW (Core-owned) ===
    view: {
        /** Current breakpoint - REQUIRED, wrapper always provides this */
        breakpoint: Breakpoint;
    };

    // === EXTENSIONS (future/experimental - NOT YET IMPLEMENTED) ===
    extensions?: GridPolicyExtensions;
}

/**
 * Future/experimental features parked here until promoted to canonical.
 * Promotion rule: implement + test + 2+ use cases need it.
 */
export interface GridPolicyExtensions {
    // External drop (drag-to-add from sidebar/modal)
    allowExternalDrop?: boolean;
    externalDropPlaceholder?: { w: number; h: number };

    // Plugin slots for surface-specific behavior
    plugins?: {
        filterWidgets?: (widgets: FramerrWidget[]) => FramerrWidget[];
        beforeRender?: (layout: LayoutModel) => LayoutModel;
        afterLayoutChange?: (layout: LayoutModel) => void;
    };

    // Gradual rollout flags
    experimental?: {
        newTouchGestures?: boolean;
        enhancedSelection?: boolean;
    };
}

// ============================================================================
// ACTIVATION STATE
// ============================================================================

/**
 * ActivationState tracks which widget is currently being interacted with.
 * Used for visual feedback (pulse, shadows, resize handles).
 */
export interface ActivationState {
    /** Currently activated widget ID (null = none) */
    activeWidgetId: string | null;
    /** Type of activation */
    activationType: 'drag' | 'resize' | 'select' | 'touch-unlock' | null;
    /** Whether touch unlock animation is in progress */
    isTouchUnlocking?: boolean;
}

// ============================================================================
// HISTORY (Widget-Centric)
// ============================================================================

/**
 * History snapshot contains full widget state.
 * This is what gets pushed/popped during undo/redo.
 *
 * @important History stores full widget state, not just layouts.
 * This ensures add/delete/config changes are all captured.
 */
export interface HistorySnapshot {
    /** Full widget state including configs */
    widgets: FramerrWidget[];
    /** Optional selection state */
    selectedWidgetId?: string | null;
}

/**
 * Named stack identifiers for multi-stack history
 */
export type HistoryStackName = 'desktop' | 'mobile';

/**
 * Multi-stack history hook interface
 * 
 * Provides separate undo/redo stacks for desktop and mobile layouts.
 * Consumers create one instance and access both stacks through named methods.
 * 
 * @example
 * ```tsx
 * const history = useLayoutHistory();
 * 
 * // Push to specific stack
 * history.push('desktop', snapshot);
 * history.push('mobile', snapshot);
 * 
 * // Undo from specific stack
 * const prev = history.undo('desktop');
 * 
 * // Check specific stack
 * if (history.canUndo('mobile')) { ... }
 * 
 * // Clear all or specific
 * history.clear(); // all stacks
 * history.clear('desktop'); // just desktop
 * ```
 */
export interface UseLayoutHistoryReturn {
    /** Push a new snapshot to a specific stack */
    push: (stack: HistoryStackName, snapshot: HistorySnapshot) => void;
    /** Undo - returns previous snapshot from stack or null */
    undo: (stack: HistoryStackName) => HistorySnapshot | null;
    /** Redo - returns next snapshot from stack or null */
    redo: (stack: HistoryStackName) => HistorySnapshot | null;
    /** Can we undo from stack? */
    canUndo: (stack: HistoryStackName) => boolean;
    /** Can we redo from stack? */
    canRedo: (stack: HistoryStackName) => boolean;
    /** Clear history - all stacks if no arg, specific stack if provided */
    clear: (stack?: HistoryStackName) => void;
    /** Push current state to redo stack (before applying undo result) */
    pushToRedo: (stack: HistoryStackName, snapshot: HistorySnapshot) => void;
    /** Push current state to undo stack (before applying redo result) */
    pushToUndo: (stack: HistoryStackName, snapshot: HistorySnapshot) => void;
}

// ============================================================================
// EVENT CONTRACTS
// ============================================================================

/**
 * LayoutEvent - Emitted when layout changes occur.
 */
export interface LayoutEvent {
    /** Updated widget state */
    widgets: FramerrWidget[];
    /** Reason for the change */
    reason: 'drag' | 'resize' | 'programmatic' | 'add' | 'remove';
    /** ID of the affected widget (if applicable) */
    affectedId?: string;
}

/**
 * GridEventHandlers - Callbacks for grid events.
 * Used by wrappers to respond to Core events.
 */
export interface GridEventHandlers {
    /** During drag/resize (if commitStrategy='on-change') */
    onLayoutPreview?: (event: LayoutEvent) => void;
    /** On drag/resize stop (always) */
    onLayoutCommit?: (event: LayoutEvent) => void;
    /** Widget selected/deselected */
    onWidgetSelect?: (id: string | null) => void;
    /** Widget action triggered (context menu, etc.) */
    onWidgetAction?: (id: string, action: 'delete' | 'configure' | 'duplicate') => void;
    /** Drag started (for undo snapshot) */
    onDragStart?: () => void;
    /** Drag stopped */
    onDragStop?: () => void;
    /** Resize started (for undo snapshot) */
    onResizeStart?: () => void;
    /** External widget dropped onto grid */
    onExternalDrop?: (event: ExternalDropEventData) => void;
}

/**
 * Data provided when an external widget is dropped onto the grid.
 */
export interface ExternalDropEventData {
    /** Widget type from data-widget-type */
    widgetType: string;
    /** Drop position X (grid units) */
    x: number;
    /** Drop position Y (grid units) */
    y: number;
    /** Widget width (grid units) */
    w: number;
    /** Widget height (grid units) */
    h: number;
    /** Generated widget ID */
    id: string;
    /** Widget constraints from data-widget-constraints */
    constraints?: {
        minW?: number;
        maxW?: number;
        minH?: number;
        maxH?: number;
    };
}

// ============================================================================
// CHANGE DETECTION
// ============================================================================

/**
 * Options for change detection comparison.
 */
export interface ChangeDetectionOptions {
    /** Compare layout positions (x, y, w, h) */
    compareLayout?: boolean;
    /** Compare widget config objects */
    compareConfig?: boolean;
    /** Which breakpoint's layout to compare */
    breakpoint?: Breakpoint;
}

/**
 * Result of change detection check.
 */
export interface ChangeDetectionResult {
    /** Whether any changes exist */
    hasChanges: boolean;
    /** IDs of widgets that changed */
    changedIds?: string[];
}

// ============================================================================
// EXTERNAL DRAG (dnd-kit Integration)
// ============================================================================

/**
 * Source context for external drag operations.
 * Identifies where the drag originated from.
 */
export type ExternalDragSource = 'palette' | 'modal' | 'sidebar';

/**
 * Captured dimensions of the source element at drag start.
 * Used for morph animation calculations.
 */
export interface SourceRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/**
 * ExternalDragData - Data attached to draggable items from external sources.
 * 
 * Used by palette items, modal cards, and sidebar items when dragging
 * into the grid. Core uses this to create tentative widgets.
 * 
 * @example
 * ```tsx
 * const { attributes, listeners, setNodeRef } = useDraggable({
 *     id: `palette-${type}`,
 *     data: {
 *         type: 'clock',
 *         widgetWidth: 4,
 *         widgetHeight: 2,
 *         sourceContext: 'palette',
 *         label: 'Clock Widget',
 *     } satisfies ExternalDragData,
 * });
 * ```
 */
export interface ExternalDragData {
    /** Widget type to create (e.g., 'clock', 'weather') */
    type: string;
    /** Display label for the widget */
    label: string;
    /** Target widget width in grid columns */
    widgetWidth: number;
    /** Target widget height in grid rows */
    widgetHeight: number;
    /** Where this drag originated */
    sourceContext: ExternalDragSource;
    /** 
     * Captured source rect (set dynamically on drag start).
     * Used for morph animation to know original size.
     */
    sourceRect?: SourceRect;
}

/**
 * Phase of the drag overlay during external drag.
 * Used to control morph animation and content rendering.
 */
export type DragPhase = 'source' | 'morphing' | 'target';

/**
 * Configuration for morph animation behavior.
 */
export interface MorphAnimationConfig {
    /** Spring stiffness (default: 500) */
    stiffness?: number;
    /** Spring damping (default: 25) */
    damping?: number;
    /** Spring mass (default: 0.8) */
    mass?: number;
    /** Content crossfade duration in ms (default: 120) */
    crossfadeDuration?: number;
}

/**
 * State returned by useMorphAnimation hook.
 */
export interface MorphAnimationState {
    /** Whether currently in morphed (target) state */
    isMorphed: boolean;
    /** Current phase of the drag */
    phase: DragPhase;
    /** Interpolated dimensions for the overlay */
    dimensions: { width: number; height: number };
    /** Offset to apply for center-stable morph */
    offset: { x: number; y: number };
    /** 0-1 progress of the morph animation */
    morphProgress: number;
}

// ============================================================================
// CONSTRAINTS
// ============================================================================

/**
 * Widget size constraints from plugin registry.
 */
export interface WidgetConstraints {
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
}

/**
 * Function type for getting constraints for a widget.
 */
export type GetConstraintsFn = (widgetType: string) => WidgetConstraints | undefined;
