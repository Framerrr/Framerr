/**
 * useServiceLayout Hook
 * 
 * Lightweight hook for Service Status layout calculation.
 * Used by both real widget and preview mode for consistent responsive sizing.
 * 
 * Uses ResizeObserver for real-time measurements. In scaled contexts (Template Builder),
 * pass `transformScale` to unscale the DOM measurements back to virtual dimensions.
 * Pass `containerHeight/containerWidth` as initial values for faster first paint.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { LayoutResult } from '../types';
import { calculateOptimalLayout } from '../utils/layoutUtils';

interface UseServiceLayoutProps {
    /** Number of monitors/items to layout */
    itemCount: number;
    /** Skip ResizeObserver setup (for SSR or when container not yet rendered) */
    skipObserver?: boolean;
    /** Pre-calculated container height (optional - for initial fast paint in scaled contexts) */
    containerHeight?: number;
    /** Pre-calculated container width (optional - for initial fast paint in scaled contexts) */
    containerWidth?: number;
    /** Transform scale factor (for scaled contexts like Template Builder preview) */
    transformScale?: number;
}

interface UseServiceLayoutReturn {
    containerRef: React.RefObject<HTMLDivElement | null>;
    layout: LayoutResult;
    containerSize: { width: number; height: number };
}

export function useServiceLayout({
    itemCount,
    skipObserver = false,
    containerHeight,
    containerWidth,
    transformScale = 1
}: UseServiceLayoutProps): UseServiceLayoutReturn {
    const containerRef = useRef<HTMLDivElement>(null);

    // Use provided dimensions as initial values for faster first paint
    const [containerSize, setContainerSize] = useState(() => ({
        width: containerWidth ?? 0,
        height: containerHeight ?? 0
    }));

    // effectiveSize is containerSize - ResizeObserver will update it with unscaled values
    const effectiveSize = containerSize;

    // Measure container size with ResizeObserver
    // In scaled contexts, we unscale the measurements to get virtual dimensions
    useEffect(() => {
        if (skipObserver) return;

        const measureContainer = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                // Only update if we got real dimensions
                if (rect.width > 0 && rect.height > 0) {
                    // Unscale measurements to get virtual dimensions in scaled contexts
                    const virtualWidth = rect.width / transformScale;
                    const virtualHeight = rect.height / transformScale;
                    setContainerSize({ width: virtualWidth, height: virtualHeight });
                }
            }
        };

        // Use requestAnimationFrame for initial measurement to ensure DOM has finished layout
        // This fixes race condition where container hasn't been sized yet on first mount
        let rafId: number;
        let retryTimeoutId: ReturnType<typeof setTimeout>;

        const initialMeasure = () => {
            rafId = requestAnimationFrame(() => {
                measureContainer();

                // If still 0, retry after a short delay (grid might still be calculating)
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        retryTimeoutId = setTimeout(measureContainer, 50);
                    }
                }
            });
        };

        initialMeasure();

        const resizeObserver = new ResizeObserver(() => {
            measureContainer();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            cancelAnimationFrame(rafId);
            clearTimeout(retryTimeoutId);
            resizeObserver.disconnect();
        };
    }, [skipObserver, transformScale]);

    // Calculate layout based on container size and item count
    const layout = useMemo(() => {
        if (effectiveSize.width === 0 || effectiveSize.height === 0) {
            return {
                cardSize: 64,
                cardsPerRow: 4,
                rowCount: 1,
                visibleCount: itemCount,
                variant: 'expanded' as const
            };
        }

        // Use compact layout for short widgets (h=1 or h=2 with header)
        // Threshold 64px: h=2 without header measures ~65px, should be expanded
        const useCompact = effectiveSize.height < 64;

        // Determine padding before calculating layout
        const padding = useCompact ? 2 : 8;
        const availableWidth = effectiveSize.width - (padding * 2);
        const availableHeight = effectiveSize.height - (padding * 2);

        return calculateOptimalLayout(
            availableWidth,
            availableHeight,
            itemCount,
            useCompact
        );
    }, [effectiveSize.width, effectiveSize.height, itemCount]);

    return {
        containerRef,
        layout,
        containerSize: effectiveSize
    };
}

