/**
 * useResizeHeightLock - Prevent page collapse during widget resize
 * 
 * Problem: When resizing a widget smaller at the bottom of the grid, the grid
 * height shrinks, the page collapses, and the resize handle moves away from the
 * cursor — creating a frustrating feedback loop.
 * 
 * Solution: Trailing buffer algorithm.
 * - On resize start, capture the "floor" (original container height)
 * - Track the "peak" (highest the grid has been during this resize)
 * - When growing: page grows naturally, floor is maintained as baseline
 * - When shrinking below peak: minHeight = max(floor, gridHeight + BUFFER)
 * - On release: smoothly animate min-height back to natural height
 * 
 * Key design: We observe the GRID CHILD element (.grid-stack) for natural height
 * changes, but apply min-height to the CONTAINER (parent). This cleanly separates
 * measurement from override — no feedback loop possible.
 * 
 * Usage:
 *   const { containerRef, onResizeStart, onResizeStop } = useResizeHeightLock();
 *   <div ref={containerRef}>...</div>
 */

import { useRef, useCallback } from 'react';

/** Pixels of cushion kept below the grid when shrinking */
const BUFFER_PX = 150;

/** Duration of the collapse animation on resize stop */
const COLLAPSE_DURATION_MS = 200;

/** Selector for the grid element inside the container */
const GRID_SELECTOR = '.grid-stack';

interface UseResizeHeightLockReturn {
    /** Attach this ref to the container whose height should be locked */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Call when widget resize begins */
    onResizeStart: () => void;
    /** Call when widget resize ends */
    onResizeStop: () => void;
}

export function useResizeHeightLock(): UseResizeHeightLockReturn {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const floorRef = useRef<number>(0);
    const peakRef = useRef<number>(0);
    const resizingRef = useRef<boolean>(false);
    const observerRef = useRef<ResizeObserver | null>(null);
    const transitionCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onResizeStart = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;

        // Find the grid element inside the container
        const gridEl = el.querySelector(GRID_SELECTOR) as HTMLElement | null;
        if (!gridEl) return;

        // Cancel any pending collapse animation from a previous resize
        if (transitionCleanupRef.current !== null) {
            clearTimeout(transitionCleanupRef.current);
            transitionCleanupRef.current = null;
        }

        // Capture floor (current container height) — this is the minimum we'll allow
        const containerHeight = el.scrollHeight;
        floorRef.current = containerHeight;

        // Track peak as the grid element's height (what we actually observe)
        peakRef.current = gridEl.scrollHeight;
        resizingRef.current = true;

        // Lock container at its current height immediately — prevents any collapse
        el.style.transition = 'none';
        el.style.minHeight = `${containerHeight}px`;

        // Observe the GRID element (child) — its height changes reflect the actual
        // widget layout changes, without being affected by our min-height on the container
        observerRef.current = new ResizeObserver(([entry]) => {
            if (!resizingRef.current || !containerRef.current) return;

            const gridHeight = entry.contentRect.height;

            // Update peak (only ratchets up)
            if (gridHeight > peakRef.current) {
                peakRef.current = gridHeight;
            }

            // Growing or at peak — let container grow naturally, but keep floor
            if (gridHeight >= peakRef.current) {
                containerRef.current.style.minHeight = `${floorRef.current}px`;
                return;
            }

            // Shrinking below peak — apply trailing buffer with floor clamp
            // We need to estimate what the container height would be from the grid height.
            // Container height ≈ grid height + container's own padding/gaps
            const containerPadding = containerRef.current.offsetHeight - gridEl.offsetHeight;
            const estimatedContainerHeight = gridHeight + containerPadding;
            const target = Math.max(floorRef.current, estimatedContainerHeight + BUFFER_PX);
            containerRef.current.style.minHeight = `${target}px`;
        });
        observerRef.current.observe(gridEl);
    }, []);

    const onResizeStop = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;

        resizingRef.current = false;

        // Disconnect observer
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }

        // Read current min-height (what we're animating FROM)
        const currentMinHeight = parseInt(el.style.minHeight) || 0;

        // Get natural container height by temporarily clearing our override
        el.style.transition = 'none';
        el.style.minHeight = '';
        const naturalHeight = el.scrollHeight;

        if (currentMinHeight <= naturalHeight) {
            // No collapse needed — container is at or above where minHeight was
            return;
        }

        // Animate collapse: set back to locked value, then transition to natural
        el.style.minHeight = `${currentMinHeight}px`;

        // Force layout flush so browser registers starting value
        el.getBoundingClientRect();

        // Animate to natural height
        el.style.transition = `min-height ${COLLAPSE_DURATION_MS}ms ease-out`;
        el.style.minHeight = `${naturalHeight}px`;

        // Clean up after transition completes
        transitionCleanupRef.current = setTimeout(() => {
            if (containerRef.current) {
                containerRef.current.style.transition = '';
                containerRef.current.style.minHeight = '';
            }
            transitionCleanupRef.current = null;
        }, COLLAPSE_DURATION_MS);
    }, []);

    return { containerRef, onResizeStart, onResizeStop };
}

export default useResizeHeightLock;
