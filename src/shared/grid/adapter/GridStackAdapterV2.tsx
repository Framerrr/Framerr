/**
 * GridStackAdapterV2 - React wrapper for GridStack using official React wrapper.
 * 
 * This adapter uses the vendored official GridStack React wrapper from
 * gridstack.js (src/vendor/gridstack-react) for better React integration.
 * 
 * Key differences from V1:
 * - Uses official renderCB pattern for DOM element creation
 * - Context-based grid state management
 * - More stable portal/widget sync
 * 
 * ISOLATION LAYER: This is the ONLY file that imports from vendor/gridstack-react.
 * Consumers use this adapter - they never import GridStack directly.
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Official React wrapper (vendored)
import {
    GridStackProvider,
    GridStackRenderProvider,
    useGridStackContext,
} from '../../../vendor/gridstack-react';

// Vendored GridStack types and CSS
import type { GridStackOptions, GridStackWidget, GridStackNode } from '../../../vendor/gridstack';
import { DDManager } from '../../../vendor/gridstack';
import '../../../vendor/gridstack/gridstack.min.css';
import '../../../vendor/gridstack/gridstack-extra.min.css';
import '../../../vendor/gridstack/gridstack-columns.css';

// Framerr types
import type { FramerrWidget, GridPolicy, GridEventHandlers, Breakpoint } from '../core/types';

// Widget registry for constraints
import { getWidgetMetadata } from '../../../widgets/registry';

// Logger
import logger from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface GridStackAdapterV2Props {
    /** Widgets to render */
    widgets: FramerrWidget[];
    /** Grid behavior policy */
    policy: GridPolicy;
    /** Event handlers */
    handlers: GridEventHandlers;
    /** Render function for widget content */
    renderWidget: (widget: FramerrWidget) => React.ReactNode;
    /** Optional class name for container */
    className?: string;
    /** Main grid selector for external drag sources */
    mainGridSelector?: string;
    /** Mobile layout mode */
    mobileLayoutMode?: 'linked' | 'independent';
    /** Whether mobile is pending unlink */
    pendingUnlink?: boolean;
    /** Widget visibility map */
    widgetVisibility?: Record<string, boolean>;
}

// ============================================================================
// HELPER FUNCTIONS (same interface as V1 for consistency)
// ============================================================================

/**
 * Build GridStack options from our policy format.
 */
function buildGridStackOptions(policy: GridPolicy): GridStackOptions {
    return {
        // Layout
        column: policy.view.breakpoint === 'sm'
            ? policy.layout.cols.sm || 4
            : policy.layout.cols.lg || 24,
        cellHeight: policy.layout.rowHeight,
        margin: policy.layout.margin[0],
        float: policy.layout.preventCollision,
        maxRow: 0, // Unlimited — CSS min-height handles drop zone sizing, scroll clamping prevents infinite scroll

        // Interaction
        disableDrag: !policy.interaction.canDrag,
        disableResize: !policy.interaction.canResize,

        // External drag support
        acceptWidgets: (el: Element) => {
            const htmlEl = el as HTMLElement;
            const defaultW = htmlEl.dataset?.gsW || htmlEl.getAttribute('gs-w');
            const defaultH = htmlEl.dataset?.gsH || htmlEl.getAttribute('gs-h');
            if (defaultW) htmlEl.setAttribute('gs-w', defaultW);
            if (defaultH) htmlEl.setAttribute('gs-h', defaultH);
            return true;
        },

        // Disabled - remove via delete button only
        removable: false,

        // Animation
        animate: true,
        alwaysShowResizeHandle: true,

        // Resize handles
        resizable: {
            handles: policy.interaction.resizeHandles?.join(',') || 'se',
        },
    };
}

/**
 * Convert FramerrWidget to GridStackWidget format.
 * Uses JSON `content` field to store widget metadata for the render layer.
 */
function toGridStackWidget(
    widget: FramerrWidget,
    breakpoint: Breakpoint
): GridStackWidget {
    const layout = (breakpoint === 'sm' && widget.mobileLayout)
        ? widget.mobileLayout
        : widget.layout;

    // Get constraints from registry
    const metadata = getWidgetMetadata(widget.type);
    const isMobile = breakpoint === 'sm';
    const mobileCols = 4;

    return {
        id: widget.id,
        x: layout.x,
        y: layout.y,
        w: layout.w,
        h: layout.h,
        minW: isMobile ? 1 : metadata?.minSize?.w,
        maxW: isMobile ? mobileCols : metadata?.maxSize?.w,
        minH: metadata?.minSize?.h,
        maxH: metadata?.maxSize?.h,
        // Use empty div as portal target - React will render content here
        content: `<div data-widget-portal="${widget.id}" style="position:absolute;top:0;left:0;right:0;bottom:0;"></div>`,
    };
}

/**
 * Filter hidden widgets (hide-when-empty feature).
 */
function filterVisibleWidgets(
    widgets: FramerrWidget[],
    widgetVisibility?: Record<string, boolean>,
    canDrag: boolean = true
): FramerrWidget[] {
    if (canDrag) return widgets; // Edit mode shows all
    return widgets.filter(w => widgetVisibility?.[w.id] !== false);
}

/**
 * Convert widgets array to GridStackWidget array.
 */
function toGridStackWidgets(
    widgets: FramerrWidget[],
    breakpoint: Breakpoint,
    widgetVisibility?: Record<string, boolean>,
    canDrag: boolean = true
): GridStackWidget[] {
    const visibleWidgets = filterVisibleWidgets(widgets, widgetVisibility, canDrag);
    return visibleWidgets.map(w => toGridStackWidget(w, breakpoint));
}

/**
 * Apply GridStack position changes back to FramerrWidget array.
 */
function applyGridStackChanges(
    widgets: FramerrWidget[],
    gsWidgets: GridStackNode[],
    breakpoint: Breakpoint,
    useMobileLayout: boolean
): FramerrWidget[] {
    const gsMap = new Map(gsWidgets.map(gs => [gs.id, gs]));
    const DESKTOP_COLS = 24;
    const MOBILE_COLS = 4;

    return widgets.map(widget => {
        const gsWidget = gsMap.get(widget.id);
        if (!gsWidget) return widget;

        const currentLayout = (breakpoint === 'sm' && widget.mobileLayout)
            ? widget.mobileLayout
            : widget.layout;
        const gsX = gsWidget.x ?? 0;
        const gsY = gsWidget.y ?? 0;
        const gsW = gsWidget.w ?? currentLayout.w;
        const gsH = gsWidget.h ?? currentLayout.h;

        // Linked mode on mobile: scale back to desktop
        if (breakpoint === 'sm' && !useMobileLayout) {
            const scale = DESKTOP_COLS / MOBILE_COLS;
            const scaledLayout = {
                x: Math.round(gsX * scale),
                y: gsY,
                w: Math.round(gsW * scale),
                h: gsH,
            };
            const mobileLayout = { x: gsX, y: gsY, w: gsW, h: gsH };
            return { ...widget, layout: scaledLayout, mobileLayout };
        }

        const newLayout = { x: gsX, y: gsY, w: gsW, h: gsH };

        // Independent mode on mobile: update mobileLayout
        if (breakpoint === 'sm' && useMobileLayout) {
            return { ...widget, mobileLayout: newLayout };
        }

        // Desktop: update layout directly
        return { ...widget, layout: newLayout };
    });
}

// ============================================================================
// INNER COMPONENT - Uses context from providers
// ============================================================================

interface GridStackInnerProps {
    widgets: FramerrWidget[];
    policy: GridPolicy;
    handlers: GridEventHandlers;
    renderWidget: (widget: FramerrWidget) => React.ReactNode;
    className?: string;
    mainGridSelector: string;
    mobileLayoutMode: 'linked' | 'independent';
    pendingUnlink: boolean;
    widgetVisibility?: Record<string, boolean>;
}

function GridStackInner({
    widgets,
    policy,
    handlers,
    renderWidget,
    className,
    mainGridSelector,
    mobileLayoutMode,
    pendingUnlink,
    widgetVisibility,
}: GridStackInnerProps): React.ReactElement {
    const { gridStack } = useGridStackContext();

    // Refs for stable callbacks
    const widgetsRef = useRef(widgets);
    const handlersRef = useRef(handlers);
    const breakpointRef = useRef<Breakpoint>(policy.view.breakpoint);
    const useMobileLayoutRef = useRef(mobileLayoutMode === 'independent' || pendingUnlink);
    const canDragRef = useRef(policy.interaction.canDrag);

    // Ref to hold updatePortalContainers (defined later) so sync effect can call it
    const updatePortalContainersRef = useRef<((w: FramerrWidget[]) => void) | null>(null);

    // Ref to hold setPortalContainers so dropped handler can add new container immediately
    const setPortalContainersRef = useRef<React.Dispatch<React.SetStateAction<Map<string, HTMLElement>>> | null>(null);

    // Keep refs updated
    useEffect(() => { widgetsRef.current = widgets; }, [widgets]);
    useEffect(() => { handlersRef.current = handlers; }, [handlers]);
    useEffect(() => { breakpointRef.current = policy.view.breakpoint; }, [policy.view.breakpoint]);
    useEffect(() => { useMobileLayoutRef.current = mobileLayoutMode === 'independent' || pendingUnlink; }, [mobileLayoutMode, pendingUnlink]);
    useEffect(() => { canDragRef.current = policy.interaction.canDrag; }, [policy.interaction.canDrag]);

    // Track recently externally dropped widgets to skip position sync for them
    // This prevents widgetCrud's shift-down logic from fighting with GridStack's collision handling
    const recentlyDroppedIdsRef = useRef<Set<string>>(new Set());

    // Skip ALL position sync until this timestamp
    // This prevents the second sync effect run (triggered by queueMicrotask) from
    // moving widgets to stale React positions after an add/remove operation
    const skipPositionSyncUntilRef = useRef<number>(0);

    // Configure touch delay
    useEffect(() => {
        DDManager.touchDelay = 200;
        DDManager.touchTolerance = 10;
    }, []);

    // Get updated widgets from grid state
    const getUpdatedWidgets = useCallback((): FramerrWidget[] => {
        if (!gridStack || !gridStack.engine) return widgetsRef.current;
        const gsWidgets = gridStack.save(false) as GridStackNode[];
        return applyGridStackChanges(
            widgetsRef.current,
            gsWidgets,
            breakpointRef.current,
            useMobileLayoutRef.current
        );
    }, [gridStack]);

    // Setup event handlers
    useEffect(() => {
        if (!gridStack || !gridStack.engine) return;

        const onDragStart = () => handlersRef.current.onDragStart?.();
        const onResizeStart = () => handlersRef.current.onResizeStart?.();

        const onDragResizeStop = (event: Event, el: HTMLElement) => {
            if (event.type === 'dragstop') {
                handlersRef.current.onDragStop?.();
            }
            if (!handlersRef.current.onLayoutCommit) return;

            const node = (el as HTMLElement & { gridstackNode?: GridStackNode }).gridstackNode;
            const updatedWidgets = getUpdatedWidgets();
            const reason = event.type === 'dragstop' ? 'drag' : 'resize';

            handlersRef.current.onLayoutCommit({
                widgets: updatedWidgets,
                reason,
                affectedId: node?.id?.toString(),
            });
        };

        const onDropped = (_event: Event, _prev: GridStackNode, newWidget: GridStackNode) => {
            if (!handlersRef.current.onExternalDrop) return;

            const el = newWidget.el as HTMLElement;
            const widgetType = el?.dataset?.widgetType || 'unknown';

            // Use position from GridStack node directly - this is the authoritative
            // final position after collision handling. DOM attributes may not be set
            // yet on mobile/touch devices when dropped event fires.
            const x = newWidget.x ?? 0;
            const y = newWidget.y ?? 0;
            const defaultW = newWidget.w || parseInt(el?.dataset?.gsW || '', 10) || 6;
            const defaultH = newWidget.h || parseInt(el?.dataset?.gsH || '', 10) || 4;

            let constraints: { minW?: number; maxW?: number; minH?: number; maxH?: number } | undefined;
            const constraintsData = el?.dataset?.widgetConstraints;
            if (constraintsData) {
                try {
                    constraints = JSON.parse(constraintsData);
                } catch {
                    logger.warn('[GridStackAdapterV2] Failed to parse widget constraints');
                }
            }

            // Generate a TEMPORARY ID with '-drop' suffix
            // This ID will NEVER match the React-generated ID, ensuring sync effect
            // runs the add/remove cycle. This replaces the dropped element (with potential
            // morph content issues) with a fresh element created by gridStack.addWidget().
            const newId = `widget-${Date.now()}-drop`;

            // Instead of remove+add (which causes all widgets to reflow twice),
            // reuse the dropped element by updating its ID and adding portal target
            if (el) {
                // Update the element's ID to match the new widget
                el.setAttribute('gs-id', newId);

                // Remove ALL child elements except GridStack resize handles
                // This is more aggressive than targeting specific classes because
                // the drag helper structure can vary between desktop and mobile touch
                const children = Array.from(el.children);
                for (const child of children) {
                    const isResizeHandle = child.classList.contains('ui-resizable-handle');
                    if (!isResizeHandle) {
                        child.remove();
                    }
                }

                // Create fresh content element
                const contentEl = document.createElement('div');
                contentEl.className = 'grid-stack-item-content';
                el.appendChild(contentEl);

                // Add our portal target to the content element
                contentEl.innerHTML = `<div data-widget-portal="${newId}" style="position:absolute;top:0;left:0;right:0;bottom:0;"></div>`;

                // Update the GridStack node's ID
                const node = (el as any).gridstackNode;
                if (node) {
                    node.id = newId;
                }

                // IMMEDIATELY add the portal container to state before onExternalDrop triggers re-render
                // This prevents the flash where the widget renders with no portal for one frame
                const portalEl = contentEl.querySelector(`[data-widget-portal="${newId}"]`) as HTMLElement | null;
                if (portalEl) {
                    setPortalContainersRef.current?.(prev => {
                        const next = new Map(prev);
                        next.set(newId, portalEl);
                        return next;
                    });
                }
            }

            // Mark this widget as recently dropped - skip position sync for it
            recentlyDroppedIdsRef.current.add(newId);
            // Clear after a short delay (allow time for React render cycle to complete)
            setTimeout(() => {
                recentlyDroppedIdsRef.current.delete(newId);
            }, 500);

            (handlersRef.current as any).onExternalDrop({
                widgetType,
                x,
                y,
                w: defaultW,
                h: defaultH,
                id: newId,
                constraints,
            });
        };

        gridStack.on('dragstart', onDragStart);
        gridStack.on('resizestart', onResizeStart);
        gridStack.on('dragstop resizestop', onDragResizeStop);
        gridStack.on('dropped', onDropped);

        return () => {
            gridStack.off('dragstart');
            gridStack.off('resizestart');
            gridStack.off('dragstop');
            gridStack.off('resizestop');
            gridStack.off('dropped');
        };
    }, [gridStack, getUpdatedWidgets]);

    // Sync widget add/remove
    useEffect(() => {
        // GridStack must exist AND be fully initialized (engine exists)
        if (!gridStack || !gridStack.engine) return;

        const gsWidgets = toGridStackWidgets(
            widgets,
            policy.view.breakpoint,
            widgetVisibility,
            policy.interaction.canDrag
        );
        const visibleIds = new Set(gsWidgets.map(w => w.id as string));

        // Get current DOM IDs
        const domElements = document.querySelectorAll(`${mainGridSelector} .grid-stack-item[gs-id]`);
        const domIds = new Set<string>();
        domElements.forEach(el => {
            const id = el.getAttribute('gs-id');
            if (id) domIds.add(id);
        });

        const addedIds = [...visibleIds].filter(id => !domIds.has(id));
        const removedIds = [...domIds].filter(id => !visibleIds.has(id));



        gridStack.batchUpdate();

        // Remove deleted widgets FIRST - free space before adding new ones
        // This is critical for external drops: the dirty drop element (with card content)
        // occupies the correct position. If we add before removing, GridStack sees a collision
        // and pushes the new widget to y=0. By removing first, we free the space.
        for (const id of removedIds) {
            const el = document.querySelector(`${mainGridSelector} [gs-id="${id}"]`) as HTMLElement;
            if (el) {
                gridStack.removeWidget(el, true);
            } else {
                // Remove from engine directly if DOM element gone
                const node = gridStack.engine.nodes.find((n: GridStackNode) => n.id === id);
                if (node) {
                    gridStack.engine.nodes = gridStack.engine.nodes.filter((n: GridStackNode) => n.id !== id);
                }
            }
        }

        // Add new widgets (into the space freed above)
        for (const id of addedIds) {
            const gsWidget = gsWidgets.find(w => w.id === id);
            if (gsWidget) {
                gridStack.addWidget({ ...gsWidget, autoPosition: false });
            }
        }

        // If we added any widgets, skip position sync for a short window
        // and commit GridStack's actual positions back to React state
        if (addedIds.length > 0) {
            skipPositionSyncUntilRef.current = Date.now() + 500;

            // CRITICAL: Sync GridStack's actual positions back to React state
            // GridStack may have adjusted positions due to collision detection.
            // We need to commit these positions so save uses correct data.
            queueMicrotask(() => {
                if (!handlersRef.current.onLayoutCommit) return;
                const updatedWidgets = getUpdatedWidgets();
                handlersRef.current.onLayoutCommit({
                    widgets: updatedWidgets,
                    reason: 'add',
                    affectedId: addedIds[0],
                });
            });
        }

        gridStack.commit();



        // NOTE: Don't call compact() here - GridStack auto-compacts based on float setting
        // Manual height recalc without compact (avoids layout shifts)

        // Sync position changes (for Cancel/Undo/Redo)
        // Skip when widgets were added - let GridStack's collision handling be authoritative
        // Otherwise we fight GridStack by moving widgets back to old positions
        // Also skip if we're in the skip window after an add operation
        const shouldSkipPositionSync = addedIds.length > 0 || Date.now() < skipPositionSyncUntilRef.current;

        if (!shouldSkipPositionSync) {
            gridStack.batchUpdate();
            for (const gsWidget of gsWidgets) {
                const el = document.querySelector(`${mainGridSelector} [gs-id="${gsWidget.id}"]`) as HTMLElement;
                if (!el) continue;

                // Skip widgets that were recently externally dropped
                // Their GridStack position is authoritative, not React's
                if (recentlyDroppedIdsRef.current.has(gsWidget.id as string)) {
                    continue;
                }

                const domX = parseInt(el.getAttribute('gs-x') || '0', 10);
                const domY = parseInt(el.getAttribute('gs-y') || '0', 10);
                const domW = parseInt(el.getAttribute('gs-w') || '1', 10);
                const domH = parseInt(el.getAttribute('gs-h') || '1', 10);

                const needsUpdate =
                    domX !== gsWidget.x ||
                    domY !== gsWidget.y ||
                    domW !== gsWidget.w ||
                    domH !== gsWidget.h;

                if (needsUpdate) {
                    gridStack.update(el, {
                        x: gsWidget.x,
                        y: gsWidget.y,
                        w: gsWidget.w,
                        h: gsWidget.h,
                    });
                }
            }
            gridStack.commit();
        }

        // Calculate max row from widget positions for gs-current-row attribute
        const maxRow = gridStack.engine.nodes.reduce((max, node) => {
            const bottom = (node.y ?? 0) + (node.h ?? 1);
            return Math.max(max, bottom);
        }, 0);
        // Use gridStack.el directly instead of DOM query for reliability
        // Let _updateContainerHeight handle min-height (it respects CSS min-height)
        // We only need to set gs-current-row for attribute tracking
        const gridEl = gridStack.el as HTMLElement;
        if (gridEl) {
            gridEl.setAttribute('gs-current-row', String(maxRow));
        }

        // Immediately update portal containers after adding widgets (prevents flash on external drop)
        if (addedIds.length > 0) {
            // Call synchronously - don't wait for RAF
            updatePortalContainersRef.current?.(widgets);
        }
    }, [widgets, gridStack, policy.view.breakpoint, widgetVisibility, policy.interaction.canDrag, mainGridSelector]);

    // Handle breakpoint/column changes
    const prevColsRef = useRef(
        policy.view.breakpoint === 'sm' ? policy.layout.cols.sm : policy.layout.cols.lg
    );

    useEffect(() => {
        if (!gridStack || !gridStack.engine) return;

        const newCols = policy.view.breakpoint === 'sm'
            ? policy.layout.cols.sm
            : policy.layout.cols.lg;
        const oldCols = prevColsRef.current;

        if (newCols !== oldCols) {
            gridStack.column(newCols, 'none');

            const gsWidgets = toGridStackWidgets(
                widgets,
                policy.view.breakpoint,
                widgetVisibility,
                policy.interaction.canDrag
            );

            gridStack.batchUpdate();
            gsWidgets.forEach(gsWidget => {
                const el = document.querySelector(`${mainGridSelector} [gs-id="${gsWidget.id}"]`) as HTMLElement;
                if (el) {
                    gridStack.update(el, {
                        x: gsWidget.x,
                        y: gsWidget.y,
                        w: gsWidget.w,
                        h: gsWidget.h,
                        minW: gsWidget.minW,
                        maxW: gsWidget.maxW,
                        minH: gsWidget.minH,
                        maxH: gsWidget.maxH,
                    });
                }
            });
            gridStack.commit();

            // Calculate max row for gs-current-row attribute
            const maxRow = gridStack.engine.nodes.reduce((max, node) => {
                const bottom = (node.y ?? 0) + (node.h ?? 1);
                return Math.max(max, bottom);
            }, 0);
            // Use gridStack.el directly instead of DOM query for reliability
            // Let _updateContainerHeight handle min-height (it respects CSS min-height)
            // We only need to set gs-current-row for attribute tracking
            const gridEl = gridStack.el as HTMLElement;
            if (gridEl) {
                gridEl.setAttribute('gs-current-row', String(maxRow));
            }

            prevColsRef.current = newCols;
        }
    }, [widgets, gridStack, policy.view.breakpoint, policy.layout.cols, widgetVisibility, policy.interaction.canDrag, mainGridSelector]);

    // Handle drag/resize enable state
    useEffect(() => {
        if (!gridStack || !gridStack.engine) return;
        gridStack.enableMove(policy.interaction.canDrag);
        gridStack.enableResize(policy.interaction.canResize);
    }, [gridStack, policy.interaction.canDrag, policy.interaction.canResize]);

    // Portal containers state (like V1) - use state with smart comparison to prevent flashing
    const [portalContainers, setPortalContainers] = React.useState<Map<string, HTMLElement>>(new Map());

    // Assign setPortalContainers to ref synchronously so dropped handler can use it immediately
    // (useEffect runs after render, which is too late)
    setPortalContainersRef.current = setPortalContainers;

    /**
     * Update portal containers from DOM.
     * Preserves existing containers and only adds/removes changed ones.
     * This prevents flash by keeping stable references for existing widgets.
     */
    const updatePortalContainers = useCallback((currentWidgets: FramerrWidget[]) => {
        setPortalContainers(prev => {
            const widgetIds = new Set(currentWidgets.map(w => w.id));
            let hasChanges = false;
            const result = new Map<string, HTMLElement>();

            // First, keep all existing containers that are still valid
            for (const [id, element] of prev) {
                if (widgetIds.has(id)) {
                    // Keep existing container if still in DOM
                    if (document.contains(element)) {
                        result.set(id, element);
                    } else {
                        hasChanges = true;
                    }
                } else {
                    // Widget removed
                    hasChanges = true;
                }
            }

            // Second, add containers for new widgets
            for (const widget of currentWidgets) {
                if (!result.has(widget.id)) {
                    const portal = document.querySelector(
                        `${mainGridSelector} [data-widget-portal="${widget.id}"]`
                    ) as HTMLElement | null;
                    if (portal) {
                        result.set(widget.id, portal);
                        hasChanges = true;
                    }
                }
            }

            // Only return new Map if there were actual changes
            return hasChanges ? result : prev;
        });
    }, [mainGridSelector]);

    // Store updatePortalContainers in ref so sync effect can call it
    useEffect(() => {
        updatePortalContainersRef.current = updatePortalContainers;
    }, [updatePortalContainers]);

    // Update portal containers when widgets change
    useEffect(() => {
        if (!gridStack || !gridStack.engine) return;
        // Use requestAnimationFrame for proper timing (after DOM update)
        requestAnimationFrame(() => {
            updatePortalContainers(widgets);
        });
    }, [gridStack, widgets, updatePortalContainers]);

    return (
        <>
            {/* Render widgets via portals */}
            {widgets.map(widget => {
                const container = portalContainers.get(widget.id);
                if (!container) return null;

                // IMPORTANT: createPortal needs a key to prevent remounts
                return createPortal(
                    renderWidget(widget),
                    container,
                    widget.id  // Stable key based on widget ID
                );
            })}
        </>
    );
}

// ============================================================================
// MAIN COMPONENT - Wraps with providers
// ============================================================================

export function GridStackAdapterV2({
    widgets,
    policy,
    handlers,
    renderWidget,
    className,
    mainGridSelector = '.grid-stack-main',
    mobileLayoutMode = 'linked',
    pendingUnlink = false,
    widgetVisibility,
}: GridStackAdapterV2Props): React.ReactElement {
    // Capture INITIAL values only - grid will be updated via effects for subsequent changes
    // Using useRef + useMemo pattern to compute once on first render only
    const initialValuesRef = useRef<{
        options: ReturnType<typeof buildGridStackOptions>;
        widgets: GridStackWidget[];
    } | null>(null);

    if (!initialValuesRef.current) {
        initialValuesRef.current = {
            options: buildGridStackOptions(policy),
            widgets: toGridStackWidgets(
                widgets,
                policy.view.breakpoint,
                widgetVisibility,
                policy.interaction.canDrag
            ),
        };
    }

    // This should never change after first render
    const initialOptions = useMemo(() => ({
        ...initialValuesRef.current!.options,
        children: initialValuesRef.current!.widgets,
    }), []);

    // Build container class
    const containerClass = [
        'grid-stack',
        mainGridSelector.replace('.', ''),
        'layout',
        className,
    ].filter(Boolean).join(' ');

    return (
        <GridStackProvider initialOptions={initialOptions}>
            <GridStackRenderProvider containerClassName={containerClass}>
                <GridStackInner
                    widgets={widgets}
                    policy={policy}
                    handlers={handlers}
                    renderWidget={renderWidget}
                    className={className}
                    mainGridSelector={mainGridSelector}
                    mobileLayoutMode={mobileLayoutMode}
                    pendingUnlink={pendingUnlink}
                    widgetVisibility={widgetVisibility}
                />
            </GridStackRenderProvider>
        </GridStackProvider>
    );
}
