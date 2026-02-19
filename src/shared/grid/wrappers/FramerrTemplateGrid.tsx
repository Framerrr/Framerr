/**
 * FramerrTemplateGrid - Template Builder Grid Wrapper
 * 
 * Wrapper component that configures GridStackAdapter for Template Builder use cases.
 * Key differences from FramerrDashboardGrid:
 * - Fixed width (not responsive/WidthProvider)
 * - Transform scale for preview scaling
 * - No auto-scroll needed
 * 
 * ARCHITECTURE: Uses GridStack for all drag/drop operations.
 * No dnd-kit dependencies - GridStack handles both internal and external drag.
 */

import { useMemo, useEffect, type ReactElement, type ReactNode } from 'react';

import { GridStackAdapterV2, setupExternalDragSources, DragPreviewPortal, DropTransitionOverlay } from '../adapter';
import type {
    GridPolicy,
    LayoutEvent,
    FramerrWidget,
    Breakpoint,
    GridEventHandlers,
    ExternalDropEventData,
} from '../core/types';
import {
    ROW_HEIGHT,
    GRID_MARGIN,
    GRID_COLS,
    COMPACT_TYPE
} from '../../../constants/gridConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface FramerrTemplateGridProps {
    // ========== Data ==========

    /** Widgets to render */
    widgets: FramerrWidget[];

    /** Fixed width in pixels (e.g., 1200 for desktop, 390 for mobile) */
    width: number;

    /** Current breakpoint (manual toggle, not viewport-driven) */
    breakpoint: Breakpoint;

    // ========== Editing ==========

    /** Whether editing is enabled (drag/resize allowed) */
    isEditable: boolean;

    /** Transform scale for preview (affects drag/resize accuracy) */
    transformScale?: number;

    /** Unique grid identifier (defaults to 'template', use different ID for preview vs editor) */
    gridId?: string;

    // ========== Callbacks ==========

    /** Abstracted layout commit callback */
    onLayoutCommit: (event: LayoutEvent) => void;

    /** Handler for external widget drops */
    onExternalWidgetDrop?: (event: ExternalDropEventData) => void;

    /** Drag start callback (for undo snapshot) */
    onDragStart?: () => void;

    /** Resize start callback (for undo snapshot) */
    onResizeStart?: () => void;

    // ========== Widget Rendering ==========

    /** Render function for each widget */
    renderWidget: (widget: FramerrWidget) => ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FramerrTemplateGrid({
    widgets,
    width,
    breakpoint,
    isEditable,
    transformScale = 1,
    gridId = 'template',
    onLayoutCommit,
    onExternalWidgetDrop,
    onDragStart,
    onResizeStart,
    renderWidget,
}: FramerrTemplateGridProps): ReactElement {

    // Build unique selector from gridId
    const mainGridSelector = `.grid-stack-${gridId}`;

    // ========== POLICY CONSTRUCTION ==========

    const policy: GridPolicy = useMemo(() => ({
        layout: {
            responsive: false,  // Fixed width, no WidthProvider
            width: width,
            cols: { lg: GRID_COLS.lg, sm: GRID_COLS.sm },
            breakpoints: { lg: 1200, sm: 0 },
            rowHeight: ROW_HEIGHT,
            margin: GRID_MARGIN,
            containerPadding: [0, 0],
            compactType: COMPACT_TYPE,
            preventCollision: false,
            transformScale: transformScale,
        },
        interaction: {
            // GridStack handles all drag and resize
            canDrag: isEditable,
            canResize: isEditable,
            resizeHandles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
            draggableCancel: '.no-drag',
            isBounded: false,  // Allow dragging to expand grid area
        },
        behavior: {
            commitStrategy: 'on-stop',
            selectionMode: 'none',
            touchActivation: 'none',  // No touch blocking for Template Builder
            autoScroll: false,        // No auto-scroll for Template Builder
        },
        view: {
            breakpoint: breakpoint,
        },
    }), [width, isEditable, transformScale, breakpoint]);

    // ========== EVENT HANDLERS ==========

    const handlers: GridEventHandlers = useMemo(() => ({
        onLayoutCommit,
        onLayoutPreview: undefined,
        onDragStart,
        onResizeStart,
        onExternalDrop: onExternalWidgetDrop,
    }), [onLayoutCommit, onDragStart, onResizeStart, onExternalWidgetDrop]);

    // ========== SETUP EXTERNAL DRAG SOURCES ==========

    useEffect(() => {
        // Setup external drag from sidebar with full morph animation
        setupExternalDragSources('.palette-item', {
            mainGridSelector,
        });
    }, [mainGridSelector]);

    // ========== RENDER WIDGET ADAPTER ==========

    const renderWidgetInternal = useMemo(() => {
        return (widget: FramerrWidget) => {
            const renderedWidget = renderWidget(widget);
            if (!renderedWidget) return null;

            // Note: GridStack handles drag visuals natively
            return (
                <div
                    data-widget-id={widget.id}
                    className={isEditable ? 'edit-mode' : 'locked'}
                    style={{
                        overflow: 'hidden',
                        width: '100%',
                        height: '100%',
                    }}
                >
                    {renderedWidget}
                </div>
            );
        };
    }, [renderWidget, isEditable]);

    // ========== RENDER ==========

    return (
        <div
            data-droppable-id="template-grid"
            style={{ width: '100%' }}
        >
            <GridStackAdapterV2
                widgets={widgets}
                policy={policy}
                handlers={handlers}
                renderWidget={renderWidgetInternal}
                className="template-grid-layout"
                mainGridSelector={mainGridSelector}
            />
            {/* Drag preview portal with preview mode for Template Builder - uses same renderWidget */}
            <DragPreviewPortal previewMode={true} renderWidget={renderWidget} transformScale={transformScale} />
            <DropTransitionOverlay renderWidget={renderWidget} transformScale={transformScale} />
        </div>
    );
}
