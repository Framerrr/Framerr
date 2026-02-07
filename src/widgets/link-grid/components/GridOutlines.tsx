/**
 * GridOutlines Component
 * 
 * Renders dashed grid outlines in edit mode to show available cell positions.
 * Shows which cells are occupied vs empty.
 */

import React, { CSSProperties } from 'react';
import type { LinkPosition } from '../types';

interface GridOutlinesProps {
    cols: number;
    rows: number;
    cellSize: number;
    gridGap: number;
    linkPositions: LinkPosition[];
    editMode: boolean;
}

export const GridOutlines: React.FC<GridOutlinesProps> = ({
    cols,
    rows,
    cellSize,
    gridGap,
    linkPositions,
    editMode
}) => {
    if (!editMode) return null;

    // Create occupancy grid to track which cells are filled
    const occupancyGrid: boolean[][] = Array(rows).fill(null).map(() => Array(cols).fill(false));

    // Mark occupied cells
    linkPositions.forEach(pos => {
        for (let c = 0; c < pos.gridColSpan; c++) {
            if (pos.gridRow < rows && pos.gridCol + c < cols) {
                occupancyGrid[pos.gridRow][pos.gridCol + c] = true;
            }
        }
    });

    const outlines: React.ReactNode[] = [];

    // Render outline for each cell
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const isOccupied = occupancyGrid[row][col];
            const style: CSSProperties = {
                position: 'absolute',
                left: `${col * (cellSize + gridGap)}px`,
                top: `${row * (cellSize + gridGap)}px`,
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                border: '2px dashed #888',
                borderRadius: '50%',
                pointerEvents: 'none',
                transition: 'opacity 0.2s ease',
                opacity: isOccupied ? 0 : 0.5, // Hide outline if cell is occupied
            };

            outlines.push(
                <div
                    key={`outline-${row}-${col}`}
                    style={style}
                />
            );
        }
    }

    return <>{outlines}</>;
};

export default GridOutlines;
