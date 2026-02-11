/**
 * FramerrDashboardGrid - Dashboard-Specific Grid Wrapper
 *
 * This wrapper adapts GridStackAdapter for the Dashboard surface.
 * It constructs the appropriate GridPolicy and handles Dashboard-specific concerns.
 *
 * ARCHITECTURE: Uses GridStack for all drag/drop operations.
 * No dnd-kit dependencies - GridStack handles both internal and external drag.
 *
 * Responsibilities:
 * - Constructs GridPolicy for responsive Dashboard layout
 * - Delegates to GridStackAdapter for actual rendering
 * - Handles external widget drops via GridStack's acceptWidgets
 */

import React, { useMemo, useEffect, useRef, type ReactNode, type ReactElement } from 'react';

import { GridStackAdapterV2, setupExternalDragSources, DragPreviewPortal } from '../adapter';
import type { FramerrWidget, GridPolicy, LayoutEvent, LayoutItem, GridEventHandlers, ExternalDropEventData } from '../core/types';
import { GRID_COLS, GRID_BREAKPOINTS, ROW_HEIGHT, GRID_MARGIN, COMPACT_TYPE } from '../../../constants/gridConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface FramerrDashboardGridProps {
    /** Widgets to render */
    widgets: FramerrWidget[];

    /** Pre-computed layouts from useDashboardLayout (vestigial - Core derives from widgets) */
    layouts: { lg: LayoutItem[]; sm: LayoutItem[] };

    /** Optional overlay for empty state - rendered inside grid container */
    emptyOverlay?: ReactNode;

    /** Whether grid is in edit mode */
    editMode: boolean;

    /** Whether viewport is mobile */
    isMobile: boolean;

    /** Current responsive breakpoint */
    currentBreakpoint: 'lg' | 'sm';

    /** Widget visibility map (for "hide when empty" feature) */
    widgetVisibility: Record<string, boolean>;

    /** Whether global drag is enabled (from useDashboardEdit) */
    isGlobalDragEnabled: boolean;

    // ========== Callbacks ==========

    /** Drag start callback */
    onDragStart: () => void;

    /** Drag stop callback */
    onDragStop?: () => void;

    /** Resize start callback */
    onResizeStart: () => void;

    /** Abstracted layout commit callback */
    onLayoutCommit: (event: LayoutEvent) => void;

    /** Handler for external widget drops */
    onExternalWidgetDrop?: (event: ExternalDropEventData) => void;

    /** Breakpoint change callback */
    onBreakpointChange: (newBreakpoint: string) => void;

    /** Render function for each widget */
    renderWidget: (widget: FramerrWidget) => ReactNode;

    // ========== Debug ==========

    /** Whether debug overlay is enabled */
    debugOverlayEnabled?: boolean;

    /** Mobile layout mode (for debug coloring) */
    mobileLayoutMode?: 'linked' | 'independent';

    /** Pending unlink state (for debug coloring) */
    pendingUnlink?: boolean;

    /** Whether to use square cells (cellHeight = 'auto') */
    squareCells?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FramerrDashboardGrid({
    widgets,
    editMode,
    isMobile,
    currentBreakpoint,
    widgetVisibility,
    isGlobalDragEnabled,
    onDragStart,
    onDragStop,
    onResizeStart,
    onLayoutCommit,
    onExternalWidgetDrop,
    renderWidget,
    debugOverlayEnabled = false,
    mobileLayoutMode = 'linked',
    pendingUnlink = false,
    emptyOverlay,
    squareCells = false,
}: FramerrDashboardGridProps): ReactElement {
    const containerRef = useRef<HTMLDivElement>(null);

    // ========== POLICY CONSTRUCTION ==========

    const policy: GridPolicy = useMemo(() => ({
        layout: {
            responsive: true,
            cols: { lg: GRID_COLS.lg, sm: GRID_COLS.sm },
            breakpoints: { lg: GRID_BREAKPOINTS.lg, sm: GRID_BREAKPOINTS.sm },
            rowHeight: (squareCells && currentBreakpoint === 'lg') ? 'auto' : ROW_HEIGHT,
            margin: GRID_MARGIN,
            containerPadding: [0, 0] as [number, number],
            compactType: COMPACT_TYPE,
            preventCollision: false,
        },
        interaction: {
            // GridStack handles all drag and resize
            canDrag: editMode && isGlobalDragEnabled,
            canResize: editMode && isGlobalDragEnabled,
            // Always create all handles - CSS hides unwanted ones per breakpoint
            // This ensures handles update responsively without requiring a page refresh
            resizeHandles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
            draggableCancel: '.no-drag',
            isBounded: false,
            touchBlockingActive: false,
        },
        behavior: {
            commitStrategy: 'on-stop',
            selectionMode: 'none',
            touchActivation: 'long-press',
            autoScroll: true,
            autoScrollContainerId: 'main-scroll',
        },
        view: {
            breakpoint: currentBreakpoint,
        },
    }), [
        editMode,
        isGlobalDragEnabled,
        currentBreakpoint,
        squareCells,
    ]);

    // ========== EVENT HANDLERS ==========

    const handlers: GridEventHandlers = useMemo(() => ({
        onLayoutCommit,
        onLayoutPreview: undefined, // Not using preview for dashboard
        onDragStart,
        onDragStop,
        onResizeStart,
        onExternalDrop: onExternalWidgetDrop,
    }), [onLayoutCommit, onDragStart, onDragStop, onResizeStart, onExternalWidgetDrop]);

    // ========== SETUP EXTERNAL DRAG SOURCES ==========

    useEffect(() => {
        // Setup external drag from modals with full morph animation
        setupExternalDragSources('.modal-widget, .palette-item', {
            mainGridSelector: '.grid-stack-main',
        });
    }, []);

    // ========== RENDER WIDGET ==========

    const renderWidgetInternal = useMemo(() => {
        return (widget: FramerrWidget) => {
            const renderedWidget = renderWidget(widget);
            if (!renderedWidget) return null;

            // Compute debug background color
            const debugBgColor = debugOverlayEnabled
                ? (pendingUnlink
                    ? 'rgba(249, 115, 22, 0.1)'
                    : mobileLayoutMode === 'independent'
                        ? 'rgba(34, 197, 94, 0.1)'
                        : 'rgba(59, 130, 246, 0.1)')
                : undefined;

            // Note: GridStack handles drag visuals natively
            // No need for DraggableWidget wrapper
            return (
                <div
                    data-widget-id={widget.id}
                    className={editMode ? 'edit-mode' : 'locked'}
                    style={{
                        backgroundColor: debugBgColor,
                        overflow: 'hidden',
                        width: '100%',
                        height: '100%',
                    }}
                >
                    {renderedWidget}
                </div>
            );
        };
    }, [
        renderWidget,
        editMode,
        debugOverlayEnabled,
        pendingUnlink,
        mobileLayoutMode,
    ]);

    // ========== ROW DEBUG OVERLAY ==========
    // Shows row numbers visually on the grid - adaptive to container height
    const [containerHeight, setContainerHeight] = React.useState(0);

    // Track container height for adaptive row overlay
    useEffect(() => {
        if (!debugOverlayEnabled) return;

        const updateHeight = () => {
            if (containerRef.current) {
                setContainerHeight(containerRef.current.getBoundingClientRect().height);
            }
        };

        // Initial measurement
        updateHeight();

        // ResizeObserver for dynamic updates
        const observer = new ResizeObserver(updateHeight);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [debugOverlayEnabled]);

    const rowDebugOverlay = useMemo(() => {
        if (!debugOverlayEnabled) return null;

        const cellHeight = ROW_HEIGHT + (GRID_MARGIN[1] ?? 10);
        // Calculate actual available rows based on container height
        const numRows = Math.ceil(containerHeight / cellHeight) || 1;

        return (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1000, overflow: 'hidden' }}>
                {Array.from({ length: numRows }, (_, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            top: i * cellHeight,
                            left: 0,
                            right: 0,
                            height: cellHeight,
                            borderTop: '1px dashed rgba(255,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            paddingLeft: 4,
                            paddingTop: 2,
                        }}
                    >
                        <span style={{
                            fontSize: 10,
                            color: 'red',
                            backgroundColor: 'rgba(255,255,255,0.8)',
                            padding: '0 4px',
                            borderRadius: 2,
                        }}>
                            row {i}
                        </span>
                    </div>
                ))}
            </div>
        );
    }, [debugOverlayEnabled, containerHeight]);

    // ========== RENDER ==========

    return (
        <div
            ref={containerRef}
            data-droppable-id="dashboard-grid"
            data-grid-container="dashboard-grid"
            style={{
                width: '100%',
                position: 'relative',
                // When empty, fill remaining viewport height (same as parent container)
                minHeight: widgets.length === 0 ? 'calc(100dvh - 200px)' : undefined,
            }}
        >
            {rowDebugOverlay}
            <GridStackAdapterV2
                widgets={widgets}
                policy={policy}
                handlers={handlers}
                renderWidget={renderWidgetInternal}
                className="layout"
                mainGridSelector=".grid-stack-main"
                mobileLayoutMode={mobileLayoutMode}
                pendingUnlink={pendingUnlink}
                widgetVisibility={widgetVisibility}
            />
            {/* Drag preview portal renders React widgets into GridStack drag helpers */}
            <DragPreviewPortal previewMode={false} renderWidget={renderWidget} />
            {/* Empty overlay renders INSIDE grid container for proper z-index stacking */}
            {emptyOverlay}
        </div>
    );
}

export default FramerrDashboardGrid;
