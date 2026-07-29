/**
 * AddButton Component
 *
 * Renders the "+" control in edit mode that opens the add link form.
 * Positioned in the next available grid cell.
 *
 * Same grab contract as LinkItem tiles (TASK-20260727-004): hold/drag moves the
 * whole Link Grid widget; quick tap opens the add form. Must not use native
 * <button>, .no-drag, or stopPropagation on pointerdown — those block GridStack.
 */

import React from 'react';
import { Plus } from 'lucide-react';
import type { LinkPosition } from '../types';
import { findNextCellPosition } from '../utils/gridLayout';
import { consumeGridDragSuppression } from '../../../utils/gridDragClickSuppression';

interface AddButtonProps {
    linkPositions: LinkPosition[];
    cols: number;
    cellSize: number;
    gridGap: number;
    onClick: () => void;
}

export const AddButton: React.FC<AddButtonProps> = ({
    linkPositions,
    cols,
    cellSize,
    gridGap,
    onClick
}) => {
    const { col, row } = findNextCellPosition(linkPositions, cols);

    const handleActivate = (e: React.MouseEvent | React.KeyboardEvent): void => {
        if (consumeGridDragSuppression(e.currentTarget as Element)) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        onClick();
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label="Add link"
            onClick={handleActivate}
            onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                handleActivate(e);
            }}
            className="absolute p-4 border-2 border-dashed border-theme hover:border-accent rounded-full transition-all hover:scale-105 flex items-center justify-center bg-theme-tertiary hover:bg-theme-hover cursor-pointer z-20 edit-clickable"
            style={{
                left: `${col * (cellSize + gridGap)}px`,
                top: `${row * (cellSize + gridGap)}px`,
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                pointerEvents: 'auto',
            }}
        >
            <Plus size={32} className="text-theme-secondary" />
        </div>
    );
};

export default AddButton;
