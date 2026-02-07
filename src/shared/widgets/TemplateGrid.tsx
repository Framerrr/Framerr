/**
 * TemplateGrid - Shared grid rendering component
 * 
 * Used by TemplateBuilderStep2 (edit mode) and TemplatePreviewModal (read-only).
 * Renders widgets with same layout and styling regardless of edit mode.
 * 
 * REFACTORED: Uses FramerrTemplateGrid to encapsulate RGL imports.
 * Updated to use Core-based wrapper with abstracted callbacks.
 */

import React, { useMemo, useCallback } from 'react';
import { getWidgetIcon, getWidgetMetadata, getPreviewWidget } from '../../widgets/registry';
import { getMockWidget } from '../../settings/templates/builder/mocks/MockWidgets';
import { WidgetRenderer } from './WidgetRenderer';
import { ROW_HEIGHT, GRID_COLS, GRID_MARGIN } from '../../constants/gridConfig';
import { FramerrTemplateGrid } from '../grid';
import type { FramerrWidget, LayoutEvent, Breakpoint } from '../grid/core/types';

// Virtual widths for scaled preview
const VIRTUAL_DESKTOP_WIDTH = 1200;
const VIRTUAL_MOBILE_WIDTH = 390;

interface TemplateWidget {
    type: string;
    layout: { x: number; y: number; w: number; h: number };
    config?: {
        showHeader?: boolean;
        flatten?: boolean;
        [key: string]: unknown;
    };
}

interface TemplateGridProps {
    /** Widgets to render */
    widgets: TemplateWidget[];
    /** Current view mode */
    viewMode: 'desktop' | 'mobile';
    /** Mobile layout mode (linked or independent) */
    mobileLayoutMode?: 'linked' | 'independent';
    /** Enable edit mode (drag, resize, delete) */
    editMode?: boolean;
    /** Scale factor for the grid (1 = full size) */
    scaleFactor?: number;
    /** Container width to calculate scale (if scaleFactor not provided) */
    containerWidth?: number;
    /** Callback when layout commits (after drag/resize) */
    onLayoutCommit?: (event: LayoutEvent) => void;
    /** Callback when widget is removed (edit mode only) */
    onRemoveWidget?: (index: number) => void;
    /** Selected widget index (edit mode only) */
    selectedWidgetIndex?: number | null;
    /** Callback when widget is selected (edit mode only) */
    onSelectWidget?: (index: number) => void;
    /** Callback when drag starts (for undo snapshot) */
    onDragStart?: () => void;
    /** Callback when resize starts (for undo snapshot) */
    onResizeStart?: () => void;
    /** Unique grid identifier to avoid selector collisions (editor vs preview) */
    gridId?: string;
}

export const TemplateGrid: React.FC<TemplateGridProps> = ({
    widgets,
    viewMode,
    mobileLayoutMode = 'linked',
    editMode = false,
    scaleFactor: providedScaleFactor,
    containerWidth,
    onLayoutCommit,
    onRemoveWidget,
    selectedWidgetIndex,
    onSelectWidget,
    onDragStart,
    onResizeStart,
    gridId = 'template',
}) => {
    // Calculate virtual width and columns
    const virtualWidth = viewMode === 'mobile' ? VIRTUAL_MOBILE_WIDTH : VIRTUAL_DESKTOP_WIDTH;

    // Calculate scale factor
    const scaleFactor = providedScaleFactor ?? (containerWidth ? Math.min(1, (containerWidth - 32) / virtualWidth) : 1);

    // Determine if editing is allowed
    const isEditable = editMode && (viewMode === 'desktop' || (viewMode === 'mobile' && mobileLayoutMode === 'independent'));

    // Current breakpoint for Core
    const currentBreakpoint: Breakpoint = viewMode === 'mobile' ? 'sm' : 'lg';

    // Convert TemplateWidget[] to FramerrWidget[] with proper layout based on view mode
    const framerWidgets: FramerrWidget[] = useMemo(() => {
        if (viewMode === 'mobile' && mobileLayoutMode === 'linked') {
            // Auto-generate stacked mobile layout
            let mobileY = 0;
            return widgets.map((widget, index) => {
                const layout = {
                    x: 0,
                    y: mobileY,
                    w: GRID_COLS.sm,
                    h: widget.layout.h,
                };
                mobileY += widget.layout.h;
                return {
                    id: `widget-${index}`,
                    type: widget.type,
                    layout,
                    config: widget.config,
                };
            });
        }
        // Desktop or independent mobile - use original layout
        return widgets.map((widget, index) => ({
            id: `widget-${index}`,
            type: widget.type,
            layout: widget.layout,
            config: widget.config,
        }));
    }, [widgets, viewMode, mobileLayoutMode]);

    // Calculate grid content height based on widgets
    const gridContentHeight = useMemo(() => {
        if (framerWidgets.length === 0) return 200;
        const maxY = Math.max(...framerWidgets.map(w => w.layout.y + w.layout.h));
        return (maxY * ROW_HEIGHT) + (maxY * 16) + 48; // margin + padding
    }, [framerWidgets]);

    // Render a single widget
    const renderWidget = useCallback((widget: FramerrWidget): React.ReactNode => {
        const Icon = getWidgetIcon(widget.type);
        const metadata = getWidgetMetadata(widget.type);
        // Find widget index by ID
        const widgetIndex = framerWidgets.findIndex(w => w.id === widget.id);

        const isLinkGrid = widget.type === 'link-grid';
        const showHeader = !isLinkGrid && widget.config?.showHeader !== false;

        // Calculate container dimensions for widgets that need them (like ServiceStatus)
        // This avoids ResizeObserver issues in scaled/transformed contexts
        const cols = viewMode === 'mobile' ? GRID_COLS.sm : GRID_COLS.lg;
        const colWidth = (virtualWidth - GRID_MARGIN[0] * 2) / cols;
        const rawContainerWidth = widget.layout.w * colWidth - GRID_MARGIN[0];
        const rawContainerHeight = widget.layout.h * ROW_HEIGHT - GRID_MARGIN[1];

        // Only pass dimensions if they're valid (positive numbers)
        const containerWidth = rawContainerWidth > 0 ? rawContainerWidth : undefined;
        const containerHeight = rawContainerHeight > 0 ? rawContainerHeight : undefined;

        return (
            <div
                className={`${editMode ? 'edit-mode' : ''} ${selectedWidgetIndex === widgetIndex ? 'widget-selected' : ''}`}
                style={{ width: '100%', height: '100%', ...(isEditable ? {} : { pointerEvents: 'none' }) }}
                onMouseDown={() => isEditable && onSelectWidget?.(widgetIndex)}
                onTouchStart={() => isEditable && onSelectWidget?.(widgetIndex)}
            >
                <WidgetRenderer
                    widget={{
                        id: widget.id,
                        type: widget.type,
                        layout: widget.layout,
                        config: widget.config || {},
                    }}
                    mode="preview"
                    title={metadata?.name || widget.type}
                    icon={Icon}
                    showHeader={showHeader}
                    flatten={widget.config?.flatten as boolean}
                    editMode={isEditable}
                    onDelete={isEditable ? () => onRemoveWidget?.(widgetIndex) : undefined}
                >
                    {(() => {
                        const PreviewWidget = getPreviewWidget(widget.type);
                        if (PreviewWidget) {
                            return (
                                <React.Suspense fallback={<div className="flex items-center justify-center h-full text-theme-tertiary">Loading...</div>}>
                                    <PreviewWidget
                                        widget={{
                                            id: widget.id,
                                            type: widget.type,
                                            layout: widget.layout,
                                            config: widget.config || {},
                                        }}
                                        previewMode={true}
                                        containerHeight={containerHeight}
                                        containerWidth={containerWidth}
                                    />
                                </React.Suspense>
                            );
                        }
                        const MockWidget = getMockWidget(widget.type);
                        return <MockWidget />;
                    })()}
                </WidgetRenderer>
            </div>
        );
    }, [editMode, selectedWidgetIndex, isEditable, onSelectWidget, onRemoveWidget, framerWidgets, viewMode, virtualWidth]);

    if (widgets.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <p className="text-sm text-theme-secondary">No widgets</p>
            </div>
        );
    }

    return (
        <div
            className={`p-4 ${viewMode === 'mobile' ? 'flex justify-center' : ''}`}
            style={{
                height: `${scaleFactor * gridContentHeight}px`,
                touchAction: 'none', // Prevent touch interactions in preview modes
            }}
        >
            {/* Scale wrapper - outer div for flex centering */}
            <div
                style={{
                    width: virtualWidth * scaleFactor,
                    height: gridContentHeight * scaleFactor,
                }}
            >
                {/* Inner scaled content */}
                <div
                    style={{
                        width: virtualWidth,
                        height: gridContentHeight,
                        transform: `scale(${scaleFactor})`,
                        transformOrigin: 'top left',
                    }}
                >
                    <FramerrTemplateGrid
                        widgets={framerWidgets}
                        width={virtualWidth}
                        breakpoint={currentBreakpoint}
                        isEditable={isEditable}
                        transformScale={scaleFactor}
                        gridId={gridId}
                        onLayoutCommit={onLayoutCommit ?? (() => { })}
                        onDragStart={onDragStart}
                        onResizeStart={onResizeStart}
                        renderWidget={renderWidget}
                    />
                </div>
            </div>
        </div>
    );
};

export default TemplateGrid;
