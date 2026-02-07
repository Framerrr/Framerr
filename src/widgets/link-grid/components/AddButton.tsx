/**
 * AddButton Component
 * 
 * Renders the "+" button in edit mode that opens the add link form.
 * Positioned in the next available grid cell.
 */

import React from 'react';
import { Plus } from 'lucide-react';
import type { LinkPosition } from '../types';
import { findNextCellPosition } from '../utils/gridLayout';

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

    return (
        <button
            onClick={onClick}
            onPointerDown={(e) => e.stopPropagation()}
            className="no-drag absolute p-4 border-2 border-dashed border-theme hover:border-accent rounded-full transition-all hover:scale-105 flex items-center justify-center bg-theme-tertiary hover:bg-theme-hover cursor-pointer z-20"
            style={{
                left: `${col * (cellSize + gridGap)}px`,
                top: `${row * (cellSize + gridGap)}px`,
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                pointerEvents: 'auto',
            }}
        >
            <Plus size={32} className="text-theme-secondary" />
        </button>
    );
};

export default AddButton;
