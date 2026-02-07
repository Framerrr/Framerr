/**
 * DragOverlay Component
 * 
 * Floating preview that follows the user's finger during touch drag-to-reorder.
 * Rendered in a portal to avoid clipping issues.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { getIconComponent } from '../../../utils/iconUtils';
import type { Link, TouchDragPosition } from '../types';
import { GRID_CONSTANTS } from '../types';

interface DragOverlayProps {
    link: Link;
    position: TouchDragPosition;
    cellSize: number;
}

export const DragOverlay: React.FC<DragOverlayProps> = ({
    link,
    position,
    cellSize
}) => {
    const Icon = getIconComponent(link.icon);
    const isCircle = link.size === 'circle';
    const iconSize = Math.max(16, Math.min(32, cellSize * 0.3));
    const gridGap = GRID_CONSTANTS.getGridGap(window.innerWidth);
    const previewWidth = isCircle ? cellSize : cellSize * 2 + gridGap;
    const fontSize = cellSize < 60 ? 'text-xs' : cellSize < 80 ? 'text-sm' : 'text-sm';

    return ReactDOM.createPortal(
        <div
            className="pointer-events-none"
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
                zIndex: 99999,
            }}
        >
            {/* Match exact styling of actual links */}
            <div
                className={`flex items-center justify-center border bg-theme-tertiary border-theme rounded-full shadow-xl
                    ${isCircle ? 'flex-col' : 'flex-row gap-2'}`}
                style={{
                    width: `${previewWidth}px`,
                    height: `${cellSize}px`,
                    opacity: 0.95, // Slight transparency to show it's being dragged
                }}
            >
                {link.style?.showIcon !== false && (
                    <Icon size={iconSize} className="text-accent" />
                )}
                {link.style?.showText !== false && (
                    <span className={`${fontSize} font-medium text-theme-primary ${isCircle ? 'mt-1' : ''}`}>
                        {link.title}
                    </span>
                )}
            </div>
        </div>,
        document.body
    );
};

export default DragOverlay;
