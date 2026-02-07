/**
 * Grid Layout Utilities
 * 
 * Pure functions for calculating grid dimensions and link positions.
 * These don't depend on React state - just math.
 */

import type { Link, LinkPosition, GridMetrics, ContainerSize } from '../types';
import { GRID_CONSTANTS } from '../types';

/**
 * Calculate grid dimensions and cell size
 * Width-first approach: fill horizontal space, add rows only when content overflows
 * - Calculate max columns from width (using target cell size ~60px)
 * - Calculate rows needed to fit all links in those columns
 * - Size cells to fill space within min/max range
 */
export function calculateGridMetrics(
    containerSize: ContainerSize,
    links: Link[],
    gridGap: number
): GridMetrics {
    const { MIN_CELL_SIZE, MAX_CELL_SIZE } = GRID_CONSTANTS;

    if (containerSize.width === 0 || containerSize.height === 0) {
        return { cols: 1, rows: 1, cellSize: 60, maxRows: 1 };
    }

    // Calculate total cell units needed (rectangles take 2 cells, circles take 1)
    const totalCellUnits = links.reduce((sum, link) => sum + (link.size === 'rectangle' ? 2 : 1), 0) || 1;
    const availableWidth = containerSize.width;
    const availableHeight = containerSize.height;

    // Step 1: Calculate max columns based on width (using target cell size ~60px)
    const TARGET_CELL_SIZE = 60;
    let cols = Math.max(1, Math.floor((availableWidth + gridGap) / (TARGET_CELL_SIZE + gridGap)));

    // Step 2: Calculate max rows based on available height
    const maxRowsForHeight = Math.max(1, Math.floor((availableHeight + gridGap) / (TARGET_CELL_SIZE + gridGap)));

    // Step 3: Calculate rows needed to fit all links (fill first row first, overflow to next)
    let rows = Math.min(Math.ceil(totalCellUnits / cols), maxRowsForHeight);

    // Recalculate columns if we hit row limit (need more columns per row)
    if (rows < Math.ceil(totalCellUnits / cols)) {
        cols = Math.ceil(totalCellUnits / rows);
    }

    // Step 4: Size cells to fill space
    const widthPerCell = (availableWidth - (cols - 1) * gridGap) / cols;
    const heightPerCell = (availableHeight - (maxRowsForHeight - 1) * gridGap) / maxRowsForHeight;

    // Use smaller dimension (keep square), clamp within min/max range
    let cellSize = Math.min(widthPerCell, heightPerCell);
    cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, cellSize));

    return {
        cols,
        rows: maxRowsForHeight, // Use max rows for grid (shows all available rows)
        cellSize: Math.floor(cellSize),
        maxRows: maxRowsForHeight
    };
}

/**
 * Calculate link positions (left-aligned layout)
 * Used for both edit mode and view mode
 */
export function calculateLinkPositions(
    gridCols: number,
    gridRows: number,
    links: Link[]
): LinkPosition[] {
    const positions: LinkPosition[] = [];
    let row = 0;
    let col = 0;

    for (const link of links) {
        const cellSpan = link.size === 'rectangle' ? 2 : 1;

        // Check if link fits in current row
        if (col + cellSpan > gridCols) {
            // Wrap to next row
            row++;
            col = 0;
        }

        // Check if we've run out of rows
        if (row >= gridRows) {
            break;
        }

        positions.push({
            linkId: link.id,
            gridCol: col,
            gridRow: row,
            gridColSpan: cellSpan,
            gridRowSpan: 1
        });

        col += cellSpan;
    }

    return positions;
}

/**
 * Calculate remaining capacity in the grid
 */
export function getRemainingCapacity(
    gridCols: number,
    gridRows: number,
    links: Link[]
): number {
    const totalCells = gridCols * gridRows;
    const occupiedCells = links.reduce((sum, link) => {
        return sum + (link.size === 'rectangle' ? 2 : 1);
    }, 0);
    return totalCells - occupiedCells;
}

/**
 * Calculate grid container dimensions for rendering
 */
export function calculateGridDimensions(
    cols: number,
    rows: number,
    cellSize: number,
    gridGap: number,
    linkPositions: LinkPosition[],
    editMode: boolean
): { gridWidth: number; gridHeight: number } {
    const gridHeight = rows * cellSize + (rows - 1) * gridGap;

    let gridWidth: number;
    if (editMode) {
        // Edit mode: use full columns for consistent layout
        gridWidth = cols * cellSize + (cols - 1) * gridGap;
    } else {
        // View mode: calculate width based on actual content
        // Find the rightmost column used by any link
        let maxColEnd = 0;
        linkPositions.forEach(pos => {
            const colEnd = pos.gridCol + pos.gridColSpan;
            if (colEnd > maxColEnd) maxColEnd = colEnd;
        });

        // Calculate the actual width needed for content
        const contentCols = Math.max(1, maxColEnd);
        gridWidth = contentCols * cellSize + (contentCols - 1) * gridGap;
    }

    return { gridWidth, gridHeight };
}

/**
 * Find next available cell position for the add button
 */
export function findNextCellPosition(
    linkPositions: LinkPosition[],
    cols: number
): { col: number; row: number } {
    if (linkPositions.length === 0) {
        return { col: 0, row: 0 };
    }

    const lastPosition = linkPositions[linkPositions.length - 1];
    let nextCol = lastPosition.gridCol + lastPosition.gridColSpan;
    let nextRow = lastPosition.gridRow;

    // Check if next position would overflow current row
    if (nextCol >= cols) {
        nextCol = 0;
        nextRow++;
    }

    return { col: nextCol, row: nextRow };
}
