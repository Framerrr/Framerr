/**
 * DraggableWidget - dnd-kit Draggable Wrapper
 *
 * Wraps each grid widget with dnd-kit's useDraggable hook.
 *
 * Structure:
 * - Content layer: 100% of widget, contains children
 * - Drag handle layer: Invisible overlay, inset from edges for resize handles
 */

import React, { type ReactNode, type CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { FramerrWidget } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Inset from widget edges for drag handle (px).
 * This leaves room for RGL's resize handles in corners.
 */
export const DRAG_HANDLE_INSET = 12;

// ============================================================================
// TYPES
// ============================================================================

export interface DraggableWidgetProps {
    /** The widget data */
    widget: FramerrWidget;
    /** Whether this widget is being dragged */
    isDragging: boolean;
    /** The rendered widget content */
    children: ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DraggableWidget({
    widget,
    isDragging,
    children,
}: DraggableWidgetProps): React.ReactElement {
    const { attributes, listeners, setNodeRef } = useDraggable({
        id: widget.id,
        data: { widget },
    });

    // ========== STYLES ==========

    const containerStyle: CSSProperties = {
        position: 'relative',
        width: '100%',
        height: '100%',
        // Visual feedback when dragging
        opacity: isDragging ? 0.5 : 1,
        transition: 'opacity 150ms ease',
    };

    const contentStyle: CSSProperties = {
        width: '100%',
        height: '100%',
    };

    // The drag handle is an invisible overlay inset from the edges
    // This allows resize handles at corners to remain accessible
    const dragHandleStyle: CSSProperties = {
        position: 'absolute',
        top: DRAG_HANDLE_INSET,
        left: DRAG_HANDLE_INSET,
        right: DRAG_HANDLE_INSET,
        bottom: DRAG_HANDLE_INSET,
        // Invisible but captures events
        background: 'transparent',
        cursor: 'grab',
        zIndex: 10,
        // Touch handling
        touchAction: 'none',
    };

    // ========== RENDER ==========

    return (
        <div ref={setNodeRef} style={containerStyle}>
            {/* Content layer - full size */}
            <div style={contentStyle}>
                {children}
            </div>

            {/* Drag handle overlay - invisible, captures drag events */}
            <div
                style={dragHandleStyle}
                {...listeners}
                {...attributes}
            />
        </div>
    );
}
