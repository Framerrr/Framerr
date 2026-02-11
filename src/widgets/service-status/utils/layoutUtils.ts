/**
 * Layout Utilities for Service Status Widget
 * 
 * "Pack as Large as Possible" algorithm for optimal card sizing.
 */

import { LayoutConfig, LayoutResult } from '../types';

// ============================================================================
// Layout Configuration Constants
// ============================================================================

// Card size constraints from design spec
export const COMPACT_CONFIG: LayoutConfig = {
    minSize: 100,  // min width for compact card
    maxSize: 200,  // max width for compact card
    gap: 8,
};

// Ultra-compact: icon + status dot only (no name)
export const ULTRA_COMPACT_CONFIG: LayoutConfig = {
    minSize: 36,   // min size for icon+dot
    maxSize: 200,  // same as compact - stretch to fill width
    gap: 6,
};

export const ULTRA_COMPACT_THRESHOLD = 80; // Width threshold for switching from compact to ultra-compact

export const EXPANDED_CONFIG: LayoutConfig = {
    minSize: 48,   // minimum square card size (lowered from 64 to fit 2h-with-header)
    maxSize: 500,  // effectively uncapped - let cards fill available space
    gap: 8,
};

export const COMPACT_CARD_HEIGHT = 36; // Fixed height for compact cards

// ============================================================================
// Layout Algorithm
// ============================================================================

/**
 * "Pack as Large as Possible" algorithm
 * Tries all possible row arrangements and picks the one that produces
 * the LARGEST card size, filling the container as much as possible.
 */
export function calculateOptimalLayout(
    contentWidth: number,
    contentHeight: number,
    cardCount: number,
    useCompact: boolean
): LayoutResult {
    if (cardCount === 0 || contentWidth <= 0 || contentHeight <= 0) {
        return { cardSize: 48, cardsPerRow: 1, rowCount: 1, visibleCount: 0, variant: 'expanded' };
    }

    const config = useCompact ? COMPACT_CONFIG : EXPANDED_CONFIG;
    const { minSize, gap } = config;

    // For compact cards, height is fixed - but may degrade to ultra-compact
    if (useCompact) {
        const compactGap = COMPACT_CONFIG.gap;
        const compactMin = COMPACT_CONFIG.minSize;
        const compactMax = COMPACT_CONFIG.maxSize;

        // How many compact cards CAN fit at minimum size?
        const maxCompactCards = Math.floor((contentWidth + compactGap) / (compactMin + compactGap));

        // If we can't fit all monitors as compact cards, try ultra-compact (full-width rows)
        if (maxCompactCards < cardCount) {
            // Ultra-compact: smaller cards (icon + dot only), same full-width distribution
            const ultraMin = ULTRA_COMPACT_CONFIG.minSize;
            const ultraMax = ULTRA_COMPACT_CONFIG.maxSize;
            const ultraGap = ULTRA_COMPACT_CONFIG.gap;

            // How many ultra-compact cards fit?
            const ultraCardsPerRow = Math.floor((contentWidth + ultraGap) / (ultraMin + ultraGap));
            const actualUltraCards = Math.max(1, Math.min(ultraCardsPerRow, cardCount));

            // Calculate card size to fill full width
            const totalGapWidth = (actualUltraCards - 1) * ultraGap;
            let ultraCardSize = (contentWidth - totalGapWidth) / actualUltraCards;
            ultraCardSize = Math.min(ultraCardSize, ultraMax);
            ultraCardSize = Math.max(ultraCardSize, ultraMin);

            return {
                cardSize: ultraCardSize,
                cardsPerRow: actualUltraCards,
                rowCount: 1,
                visibleCount: actualUltraCards,
                variant: 'ultra-compact'
            };
        }

        // Compact mode: all cards fit in one row
        const actualCardsPerRow = Math.max(1, Math.min(maxCompactCards, cardCount));
        const totalGapWidth = (actualCardsPerRow - 1) * compactGap;
        let cardWidth = (contentWidth - totalGapWidth) / actualCardsPerRow;
        cardWidth = Math.min(cardWidth, compactMax);
        cardWidth = Math.max(cardWidth, compactMin);

        return {
            cardSize: cardWidth,
            cardsPerRow: actualCardsPerRow,
            rowCount: 1,
            visibleCount: actualCardsPerRow,
            variant: 'compact'
        };
    }

    // Expanded cards (square) - try ALL row counts and pick the one with LARGEST cards
    let bestLayout: { cardSize: number; cardsPerRow: number; rows: number } | null = null;

    for (let rows = 1; rows <= cardCount; rows++) {
        const cardsPerRow = Math.ceil(cardCount / rows);

        // Calculate max card size for this layout
        const availableWidth = contentWidth - (cardsPerRow - 1) * gap;
        const availableHeight = contentHeight - (rows - 1) * gap;

        const widthBasedSize = availableWidth / cardsPerRow;
        const heightBasedSize = availableHeight / rows;

        // Card size limited by smaller dimension (maintain 1:1 aspect ratio)
        const cardSize = Math.min(widthBasedSize, heightBasedSize);

        // Only consider layouts where cards >= minSize
        if (cardSize >= minSize) {
            if (!bestLayout || cardSize > bestLayout.cardSize) {
                bestLayout = { cardSize, cardsPerRow, rows };
            }
        }
    }

    if (bestLayout) {
        return {
            cardSize: Math.floor(bestLayout.cardSize),
            cardsPerRow: bestLayout.cardsPerRow,
            rowCount: bestLayout.rows,
            visibleCount: cardCount,
            variant: 'expanded'
        };
    }

    // Fallback: Can't fit all cards at minSize, show as many as we can
    const cardsPerRow = Math.max(1, Math.floor((contentWidth + gap) / (minSize + gap)));
    const rowsThatFit = Math.max(1, Math.floor((contentHeight + gap) / (minSize + gap)));
    const visibleCount = Math.min(cardCount, cardsPerRow * rowsThatFit);

    return {
        cardSize: minSize,
        cardsPerRow,
        rowCount: rowsThatFit,
        visibleCount,
        variant: 'expanded'
    };
}
