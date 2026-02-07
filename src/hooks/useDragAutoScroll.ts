/**
 * useDragAutoScroll - Auto-scroll container when dragging near edges
 * 
 * Smart scroll behavior:
 * 1. Grace zone: Ignores scroll zone until pointer moves 40px from grab point
 * 2. Movement intent: Only scrolls when pointer is actively moving toward the edge
 * 
 * Note: This hook polls for pointer position during drag since react-grid-layout
 * consumes pointer events and doesn't propagate them.
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseDragAutoScrollOptions {
    enabled: boolean;
    scrollContainerId?: string;  // ID of scrollable container (default: 'main-scroll')
    edgeThreshold?: number;      // Distance from edge to trigger scroll (px)
    graceDistance?: number;      // Min distance from grab point before scroll enabled (px)
}

// Track pointer position and smoothed velocity globally
let globalPointerY = 0;
let smoothedVelocityY = 0;  // Averaged velocity over last few frames
const VELOCITY_SMOOTHING = 0.3;  // Lower = more smoothing, less responsive

// Set up global pointer tracking once
if (typeof window !== 'undefined') {
    let lastY = 0;
    const updatePointer = (e: MouseEvent | PointerEvent) => {
        const newY = e.clientY;
        const instantVelocity = newY - lastY;
        // Exponential moving average for smoother velocity
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
        scrollContainerId = 'main-scroll',
        edgeThreshold = 200,   // Start scrolling 200px from edge
        graceDistance = 40,    // Must move 40px from grab point before scroll activates
    } = options;

    const isDraggingRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);
    const grabPositionRef = useRef<number | null>(null);  // Where the drag started
    const hasLeftGraceZoneRef = useRef(false);  // Has moved 40px from grab point

    // Auto-scroll loop - runs continuously during drag
    const scrollLoop = useCallback(() => {
        if (!isDraggingRef.current) {
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

        // Speed calculation with progressive acceleration
        const minSpeed = 3;   // Slow crawl at zone boundary
        const maxSpeed = 35;  // Maximum speed at screen edge

        // Check if near top edge AND NOT moving away (down)
        // Allow scrolling if stationary (velocity ~= 0) or moving toward edge
        const inTopZone = pointerY > 0 && pointerY < edgeThreshold;
        const notMovingDown = velocity <= 2;  // Small threshold for "not moving away"

        if (inTopZone && notMovingDown) {
            // Cubic scaling - starts slow, accelerates dramatically near edge
            const normalizedPosition = 1 - (pointerY / edgeThreshold);
            const intensity = Math.pow(normalizedPosition, 3);
            const speed = minSpeed + (maxSpeed - minSpeed) * intensity;
            scrollContainer.scrollBy({ top: -speed, behavior: 'instant' });
        }

        // Check if near bottom edge AND NOT moving away (up)
        const inBottomZone = pointerY > viewportHeight - edgeThreshold && pointerY < viewportHeight;
        const notMovingUp = velocity >= -2;  // Small threshold for "not moving away"

        if (inBottomZone && notMovingUp) {
            // Cubic scaling - starts slow, accelerates dramatically near edge
            const normalizedPosition = 1 - ((viewportHeight - pointerY) / edgeThreshold);
            const intensity = Math.pow(normalizedPosition, 3);
            const speed = minSpeed + (maxSpeed - minSpeed) * intensity;
            scrollContainer.scrollBy({ top: speed, behavior: 'instant' });
        }

        animationFrameRef.current = requestAnimationFrame(scrollLoop);
    }, [scrollContainerId, edgeThreshold, graceDistance]);

    // Handle drag start
    const onDragStart = useCallback(() => {
        if (!enabled) return;
        isDraggingRef.current = true;
        grabPositionRef.current = globalPointerY;  // Remember where drag started
        hasLeftGraceZoneRef.current = false;        // Reset grace zone flag

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

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    return {
        onDragStart,
        onDragStop,
    };
};

export default useDragAutoScroll;

