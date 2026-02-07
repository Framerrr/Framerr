/**
 * useMediaRowLayout Hook
 *
 * Measures container and distributes sessions into rows for optimal layout.
 *
 * Behavior:
 * - 1-row mode (H < 500px): All sessions in single horizontal scroll
 * - 2-row mode (H >= 500px): Smart distribution:
 *   1. Fill row 1 with visible cards (partially visible OK)
 *   2. Fill row 2 with next batch
 *   3. Overflow cards distributed round-robin between rows
 *
 * Phase 4: Renamed from usePlexRowLayout.
 */

import { useState, useEffect, useRef, useMemo, type RefObject } from 'react';
import type { MediaSession } from '../adapters';

export interface MediaRowLayout {
    /** Current layout mode */
    mode: '1-row' | '2-row';
    /** Sessions split into rows */
    rows: MediaSession[][];
    /** Calculated card height for CSS */
    cardHeight: number;
    /** Whether dimensions are valid (non-zero) */
    isReady: boolean;
}

const GAP = 8; // Gap between cards in pixels
const TWO_ROW_WIDTH_THRESHOLD = 400; // Min width for 2-row mode (avoid cramped layout)

/**
 * Distribute sessions into two rows with round-robin overflow
 */
function distributeToRows(
    sessions: MediaSession[],
    cardsPerRow: number
): [MediaSession[], MediaSession[]] {
    // Fill visible slots first
    const row1 = sessions.slice(0, cardsPerRow);
    const row2 = sessions.slice(cardsPerRow, cardsPerRow * 2);

    // Distribute overflow round-robin (evens to row1, odds to row2)
    const overflow = sessions.slice(cardsPerRow * 2);
    overflow.forEach((session, i) => {
        if (i % 2 === 0) {
            row1.push(session);
        } else {
            row2.push(session);
        }
    });

    return [row1, row2];
}

/**
 * Hook to calculate optimal row layout based on container dimensions
 */
export function useMediaRowLayout(
    containerRef: RefObject<HTMLDivElement | null>,
    sessions: MediaSession[]
): MediaRowLayout {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const observerRef = useRef<ResizeObserver | null>(null);
    const observedElementRef = useRef<HTMLDivElement | null>(null);

    // Measure container with ResizeObserver
    // Track which element we're observing so we can detect when it changes (e.g., mode switch)
    useEffect(() => {
        const container = containerRef.current;

        // If no container, clean up and wait
        if (!container) {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
                observedElementRef.current = null;
            }
            return;
        }

        // If we're already observing THIS element, skip
        if (observedElementRef.current === container && observerRef.current) {
            return;
        }

        // Clean up previous observer if observing a different element
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        // Get initial dimensions
        const rect = container.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });

        // Watch for size changes
        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setDimensions({ width, height });
        });

        observer.observe(container);
        observerRef.current = observer;
        observedElementRef.current = container;

        return () => {
            observer.disconnect();
            observerRef.current = null;
            observedElementRef.current = null;
        };
    }, [containerRef.current]); // Depend on the actual element, not just the ref object

    // Calculate layout whenever dimensions or sessions change
    return useMemo((): MediaRowLayout => {
        const { width, height } = dimensions;

        // Guard: no dimensions yet (first render or unmounted)
        if (width === 0 || height === 0) {
            return {
                mode: '1-row',
                rows: [sessions],
                cardHeight: 0,
                isReady: false,
            };
        }

        // Determine mode based on card size constraint
        // 2-row mode triggers when container height > 350px (~H=8)
        const MAX_CARD_HEIGHT = 350; // Trigger 2-row mode when container height exceeds this
        const MIN_CARD_HEIGHT = 100; // Min card height to be usable

        // In 2-row mode, card height = (height - gap) / 2
        // Use 2-row mode if: 1-row card would be too tall AND 2-row cards would still be usable
        const cardHeightIn1Row = height;
        const cardHeightIn2Row = (height - GAP) / 2;

        const is2RowMode =
            cardHeightIn1Row > MAX_CARD_HEIGHT &&
            cardHeightIn2Row >= MIN_CARD_HEIGHT &&
            width >= TWO_ROW_WIDTH_THRESHOLD;
        // Calculate card dimensions (1:1 aspect ratio)
        const cardHeight = is2RowMode ? cardHeightIn2Row : cardHeightIn1Row;
        const cardWidth = cardHeight; // Square cards

        // 1-row mode: all sessions in single row
        if (!is2RowMode) {
            return {
                mode: '1-row',
                rows: [sessions],
                cardHeight,
                isReady: true,
            };
        }

        // 2-row mode: calculate cards per row and distribute
        // A card moves to next row when 80% hidden (only 20% visible)
        const VISIBLE_THRESHOLD = 0.2; // Card must be at least 20% visible to stay in current row
        const cardsPerRow = Math.max(
            1,
            Math.floor((width - VISIBLE_THRESHOLD * cardWidth) / (cardWidth + GAP)) + 1
        );
        const [row1, row2] = distributeToRows(sessions, cardsPerRow);

        return {
            mode: '2-row',
            rows: [row1, row2], // Always 2 rows - cards should never exceed 5H
            cardHeight,
            isReady: true,
        };
    }, [dimensions, sessions]);
}

export default useMediaRowLayout;
