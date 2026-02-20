/**
 * useDragAutoScroll - Auto-scroll container when dragging near edges
 * 
 * Smooth scroll behavior:
 * 1. Grace zone: Ignores scroll zone until pointer moves 40px from grab point
 * 2. Movement intent: Only scrolls when pointer is actively moving toward the edge
 * 3. Lerp interpolation: Current speed smoothly ramps toward target speed each frame
 * 4. Also listens for external-drag-start/stop events (from setupExternalDragSources)
 * 
 * Note: This hook polls for pointer position during drag since GridStack
 * consumes pointer events and doesn't propagate them.
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseDragAutoScrollOptions {
    enabled: boolean;
    scrollContainerId?: string;  // ID of scrollable container (default: 'dashboard-layer')
    edgeThreshold?: number;      // Distance from edge to trigger scroll (px)
    graceDistance?: number;      // Min distance from grab point before scroll enabled (px)
}

// Track pointer position globally
let globalPointerY = 0;
let smoothedVelocityY = 0;  // Averaged velocity
const VELOCITY_SMOOTHING = 0.2;  // Lower = more smoothing

// Set up global pointer tracking once
if (typeof window !== 'undefined') {
    let lastY = 0;
    const updatePointer = (e: MouseEvent | PointerEvent) => {
        const newY = e.clientY;
        const instantVelocity = newY - lastY;
        smoothedVelocityY = smoothedVelocityY * (1 - VELOCITY_SMOOTHING) + instantVelocity * VELOCITY_SMOOTHING;
        lastY = newY;
        globalPointerY = newY;
    };
    const updateTouchPointer = (e: TouchEvent) => {
        if (e.touches.length > 0) {
            const newY = e.touches[0].clientY;
            const instantVelocity = newY - lastY;
            smoothedVelocityY = smoothedVelocityY * (1 - VELOCITY_SMOOTHING) + instantVelocity * VELOCITY_SMOOTHING;
            lastY = newY;
            globalPointerY = newY;
        }
    };

    window.addEventListener('pointermove', updatePointer, { capture: true, passive: true });
    window.addEventListener('mousemove', updatePointer, { capture: true, passive: true });
    window.addEventListener('touchmove', updateTouchPointer, { capture: true, passive: true });
}

export const useDragAutoScroll = (options: UseDragAutoScrollOptions) => {
    const {
        enabled,
        scrollContainerId = 'dashboard-layer',
        edgeThreshold = 180,   // Start scrolling 180px from edge
        graceDistance = 40,    // Must move 40px from grab point before scroll activates
    } = options;

    const isDraggingRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);
    const grabPositionRef = useRef<number | null>(null);
    const hasLeftGraceZoneRef = useRef(false);
    const downOnlyRef = useRef(false);

    // Lerp state — smoothly interpolated each frame
    const currentSpeedRef = useRef(0);

    // Lerp factor: 0.08 = very smooth (slow ramp), 0.15 = responsive but smooth
    const LERP_FACTOR = 0.1;
    const MIN_SPEED = 1;    // Gentle crawl at zone boundary
    const MAX_SPEED = 18;   // Moderate max — dashboards aren't infinitely long

    // Auto-scroll loop - runs continuously during drag
    const scrollLoop = useCallback(() => {
        if (!isDraggingRef.current) {
            // Drag ended — reset speed smoothly to 0
            currentSpeedRef.current = 0;
            animationFrameRef.current = null;
            return;
        }

        const viewportHeight = window.innerHeight;
        const pointerY = globalPointerY;
        const velocity = smoothedVelocityY;

        // Check if we've left the grace zone (moved 40px from grab point)
        if (!hasLeftGraceZoneRef.current && grabPositionRef.current !== null) {
            const distanceFromGrab = Math.abs(pointerY - grabPositionRef.current);
            if (distanceFromGrab >= graceDistance) {
                hasLeftGraceZoneRef.current = true;
            }
        }

        // Don't scroll if still in grace zone
        if (!hasLeftGraceZoneRef.current) {
            animationFrameRef.current = requestAnimationFrame(scrollLoop);
            return;
        }

        // Get the scroll container
        const scrollContainer = document.getElementById(scrollContainerId);
        if (!scrollContainer) {
            animationFrameRef.current = requestAnimationFrame(scrollLoop);
            return;
        }

        // Calculate target speed based on pointer position
        let targetSpeed = 0;  // Positive = scroll down, negative = scroll up

        // Top edge: pointer is in top zone AND not moving away (down)
        // Skip top-edge scrolling when in downOnly mode (e.g., during resize)
        if (!downOnlyRef.current) {
            const inTopZone = pointerY > 0 && pointerY < edgeThreshold;
            const notMovingDown = velocity <= 2;

            if (inTopZone && notMovingDown) {
                // Quadratic scaling — gentler than cubic, still accelerates near edge
                const normalizedPosition = 1 - (pointerY / edgeThreshold);
                const intensity = normalizedPosition * normalizedPosition;
                targetSpeed = -(MIN_SPEED + (MAX_SPEED - MIN_SPEED) * intensity);
            }
        }

        // Bottom edge: pointer is in bottom zone AND not moving away (up)
        const inBottomZone = pointerY > viewportHeight - edgeThreshold && pointerY < viewportHeight;
        const notMovingUp = velocity >= -2;

        if (inBottomZone && notMovingUp) {
            const normalizedPosition = 1 - ((viewportHeight - pointerY) / edgeThreshold);
            const intensity = normalizedPosition * normalizedPosition;
            targetSpeed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * intensity;
        }

        // Lerp current speed toward target speed
        // This creates smooth acceleration and deceleration
        currentSpeedRef.current += (targetSpeed - currentSpeedRef.current) * LERP_FACTOR;

        // Apply scroll if speed is meaningful (avoid sub-pixel jitter)
        if (Math.abs(currentSpeedRef.current) > 0.5) {
            scrollContainer.scrollBy({ top: currentSpeedRef.current, behavior: 'instant' });
        } else {
            // Snap to zero when nearly stopped to prevent endless tiny scrolls
            currentSpeedRef.current = 0;
        }

        animationFrameRef.current = requestAnimationFrame(scrollLoop);
    }, [scrollContainerId, edgeThreshold, graceDistance]);

    // Handle drag start
    const onDragStart = useCallback(() => {
        if (!enabled) return;
        isDraggingRef.current = true;
        grabPositionRef.current = globalPointerY;
        hasLeftGraceZoneRef.current = false;
        currentSpeedRef.current = 0;  // Reset speed

        // Start the scroll loop
        if (!animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(scrollLoop);
        }
    }, [enabled, scrollLoop]);

    // Handle drag stop
    const onDragStop = useCallback(() => {
        isDraggingRef.current = false;
        grabPositionRef.current = null;
        hasLeftGraceZoneRef.current = false;
        // Don't reset currentSpeedRef here — let the loop lerp it to 0 naturally
        // (though loop exits immediately, we reset on next start)

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    // Listen for external drag events (from setupExternalDragSources)
    useEffect(() => {
        if (!enabled) return;

        const handleExternalDragStart = () => onDragStart();
        const handleExternalDragStop = () => onDragStop();

        window.addEventListener('external-drag-start', handleExternalDragStart);
        window.addEventListener('external-drag-stop', handleExternalDragStop);

        return () => {
            window.removeEventListener('external-drag-start', handleExternalDragStart);
            window.removeEventListener('external-drag-stop', handleExternalDragStop);
        };
    }, [enabled, onDragStart, onDragStop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    /** Toggle down-only mode (skips upward auto-scroll, e.g. during resize) */
    const setDownOnly = useCallback((value: boolean) => {
        downOnlyRef.current = value;
    }, []);

    return {
        onDragStart,
        onDragStop,
        setDownOnly,
    };
};

export default useDragAutoScroll;
