/**
 * Grid Core Gestures - Touch Gesture Handling
 *
 * iOS-style hold-to-drag gesture detection for mobile grid editing.
 * Extracted from useTouchDragDelay.ts for sharing across surfaces.
 *
 * ARCHITECTURE REFERENCE: docs/grid-rework/ARCHITECTURE.md Lines 936-991
 *
 * Design:
 * - Container-based event capture (single listener, not per-widget)
 * - Hold threshold detection (170ms default)
 * - Movement cancellation (5px threshold)
 * - Auto-reset after finger lift (250ms)
 * - Synthetic touch dispatch for RGL compatibility
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Time to hold before drag is enabled (ms) */
export const HOLD_THRESHOLD_MS = 200;

/** Movement distance that cancels hold detection (px) */
export const MOVE_THRESHOLD_PX = 5;

/** Auto-lock delay after finger lifted (ms) */
export const AUTO_RESET_MS = 250;

/** Time at which grow animation starts (ms) */
export const GROW_START_MS = 70;

/** Target scale during hold animation */
export const GROW_SCALE = 1.045;

// ============================================================================
// TYPES
// ============================================================================

interface TouchState {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    screenX: number;
    screenY: number;
    pageX: number;
    pageY: number;
    touchIdentifier: number;
    widgetId: string;
    targetElement: HTMLElement;
    timerId: ReturnType<typeof setTimeout> | null;
}

export interface UseTouchGesturesReturn {
    /** Widget ID that has passed hold threshold and is ready to drag */
    dragReadyWidgetId: string | null;
    /** Widget ID currently being held (before or after threshold) */
    holdingWidgetId: string | null;
    /** Hold progress for grow animation (0.0 to 1.0), starts at GROW_START_MS */
    holdProgress: number;
    /** Ref to attach to the grid container for touch blocking */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Enable/disable touch blocking (when edit mode + mobile) */
    setTouchBlockingActive: (active: boolean) => void;
    /** Manual reset - call after drag completes or when exiting edit mode */
    resetDragReady: () => void;
    /** Whether touch blocking is currently active */
    isTouchBlockingActive: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * useTouchGestures - iOS-style hold-to-drag gesture detection
 *
 * Provides touch blocking that requires a hold gesture before
 * allowing widget dragging on mobile devices.
 *
 * @returns Touch gesture state and handlers
 *
 * @example
 * ```tsx
 * const { dragReadyWidgetId, containerRef, setTouchBlockingActive } = useTouchGestures();
 *
 * useEffect(() => {
 *     setTouchBlockingActive(editMode && isMobile);
 * }, [editMode, isMobile]);
 *
 * return <div ref={containerRef}>...</div>;
 * ```
 */
export function useTouchGestures(): UseTouchGesturesReturn {
    // Widget that has passed hold threshold
    const [dragReadyWidgetId, setDragReadyWidgetId] = useState<string | null>(null);

    // Widget currently being held (for grow animation)
    const [holdingWidgetId, setHoldingWidgetId] = useState<string | null>(null);

    // Hold progress for grow animation (0.0 to 1.0)
    const [holdProgress, setHoldProgress] = useState(0);

    // Whether touch blocking is active
    const [touchBlockingActive, setTouchBlockingActive] = useState(false);

    // Container element ref
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Touch state for threshold detection
    const touchStateRef = useRef<TouchState | null>(null);

    // Auto-reset timer
    const autoResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Animation frame ref for hold progress
    const holdAnimationFrameRef = useRef<number | null>(null);

    // Hold start timestamp
    const holdStartTimeRef = useRef<number | null>(null);

    // Ref to track dragReadyWidgetId for native handlers
    const dragReadyWidgetIdRef = useRef<string | null>(null);
    useEffect(() => {
        dragReadyWidgetIdRef.current = dragReadyWidgetId;
    }, [dragReadyWidgetId]);

    // Pending synthetic touch data
    const pendingSyntheticTouchRef = useRef<{
        element: HTMLElement;
        touchData: {
            identifier: number;
            clientX: number;
            clientY: number;
            screenX: number;
            screenY: number;
            pageX: number;
            pageY: number;
        };
    } | null>(null);

    // Flag to allow synthetic events through
    const allowNextTouchRef = useRef(false);

    // ========== GLOBAL TOUCHEND FOR AUTO-RESET ==========

    useEffect(() => {
        if (!dragReadyWidgetId) return;

        const handleGlobalTouchEnd = () => {
            if (autoResetTimerRef.current) {
                clearTimeout(autoResetTimerRef.current);
            }
            autoResetTimerRef.current = setTimeout(() => {
                setDragReadyWidgetId(null);
                autoResetTimerRef.current = null;
            }, AUTO_RESET_MS);
        };

        window.addEventListener('touchend', handleGlobalTouchEnd);
        return () => window.removeEventListener('touchend', handleGlobalTouchEnd);
    }, [dragReadyWidgetId]);

    // ========== SCROLL LOCK WHEN DRAG-READY ==========

    useEffect(() => {
        if (!dragReadyWidgetId) return;

        const handleTouchMove = (e: TouchEvent) => {
            if (e.cancelable) {
                e.preventDefault();
            }
        };

        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        return () => document.removeEventListener('touchmove', handleTouchMove);
    }, [dragReadyWidgetId]);

    // ========== SYNTHETIC TOUCH DISPATCH ==========

    useEffect(() => {
        if (dragReadyWidgetId && pendingSyntheticTouchRef.current) {
            const { element, touchData } = pendingSyntheticTouchRef.current;

            allowNextTouchRef.current = true;

            requestAnimationFrame(() => {
                try {
                    const syntheticTouch = new Touch({
                        identifier: touchData.identifier,
                        target: element,
                        clientX: touchData.clientX,
                        clientY: touchData.clientY,
                        screenX: touchData.screenX,
                        screenY: touchData.screenY,
                        pageX: touchData.pageX,
                        pageY: touchData.pageY,
                        radiusX: 1,
                        radiusY: 1,
                        rotationAngle: 0,
                        force: 1,
                    });

                    const syntheticEvent = new TouchEvent('touchstart', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        touches: [syntheticTouch],
                        targetTouches: [syntheticTouch],
                        changedTouches: [syntheticTouch],
                    });

                    element.dispatchEvent(syntheticEvent);

                    setTimeout(() => {
                        allowNextTouchRef.current = false;
                    }, 50);
                } catch {
                    allowNextTouchRef.current = false;
                }
            });

            pendingSyntheticTouchRef.current = null;
        }
    }, [dragReadyWidgetId]);

    // ========== WIDGET ID FROM COORDINATES ==========

    const getWidgetIdFromCoordinates = useCallback((clientX: number, clientY: number): { widgetId: string; widgetElement: HTMLElement } | null => {
        const widgetElements = document.querySelectorAll('[data-widget-id]');

        for (const element of widgetElements) {
            const rect = (element as HTMLElement).getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right &&
                clientY >= rect.top && clientY <= rect.bottom) {
                const widgetId = element.getAttribute('data-widget-id');
                if (widgetId) {
                    return { widgetId, widgetElement: element as HTMLElement };
                }
            }
        }

        return null;
    }, []);

    // ========== NATIVE EVENT HANDLERS ==========

    const handleContainerTouchStart = useCallback((e: TouchEvent) => {
        if (allowNextTouchRef.current) return;

        // Allow resize handles
        if (e.target instanceof HTMLElement &&
            e.target.closest('.react-resizable-handle')) {
            return;
        }

        // Only single-finger touches
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);

        // Allow .no-drag elements
        if (elementAtPoint && elementAtPoint.closest('.no-drag')) {
            return;
        }

        const widgetInfo = getWidgetIdFromCoordinates(touch.clientX, touch.clientY);
        if (!widgetInfo) return;

        const { widgetId, widgetElement } = widgetInfo;

        // If already drag-ready for this widget, let touch through
        if (dragReadyWidgetIdRef.current === widgetId) {
            return;
        }

        // Block touch from reaching RGL
        e.stopImmediatePropagation();

        // Clear existing timer
        if (touchStateRef.current?.timerId) {
            clearTimeout(touchStateRef.current.timerId);
        }

        // Store touch state
        touchStateRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            currentX: touch.clientX,
            currentY: touch.clientY,
            screenX: touch.screenX,
            screenY: touch.screenY,
            pageX: touch.pageX,
            pageY: touch.pageY,
            touchIdentifier: touch.identifier,
            widgetId,
            targetElement: widgetElement,
            timerId: null,
        };

        // Set holding widget immediately for grow animation
        setHoldingWidgetId(widgetId);
        holdStartTimeRef.current = performance.now();

        // Start progress animation loop
        const animateProgress = () => {
            if (!touchStateRef.current || touchStateRef.current.widgetId !== widgetId) {
                return;
            }

            const elapsed = performance.now() - (holdStartTimeRef.current || 0);

            if (elapsed >= GROW_START_MS) {
                // Calculate progress: 0 at GROW_START_MS, 1 at HOLD_THRESHOLD_MS
                const progressRange = HOLD_THRESHOLD_MS - GROW_START_MS;
                const progressElapsed = elapsed - GROW_START_MS;
                const progress = Math.min(1, progressElapsed / progressRange);
                setHoldProgress(progress);
            }

            if (elapsed < HOLD_THRESHOLD_MS) {
                holdAnimationFrameRef.current = requestAnimationFrame(animateProgress);
            }
        };

        holdAnimationFrameRef.current = requestAnimationFrame(animateProgress);

        // Start hold timer
        const timerId = setTimeout(() => {
            if (touchStateRef.current && touchStateRef.current.widgetId === widgetId) {
                const state = touchStateRef.current;
                pendingSyntheticTouchRef.current = {
                    element: state.targetElement,
                    touchData: {
                        identifier: state.touchIdentifier,
                        clientX: state.currentX,
                        clientY: state.currentY,
                        screenX: state.screenX,
                        screenY: state.screenY,
                        pageX: state.pageX,
                        pageY: state.pageY,
                    },
                };

                setDragReadyWidgetId(widgetId);
                // Keep holdProgress at 1.0 and holdingWidgetId set while dragging
                setHoldProgress(1);
                state.timerId = null;
            }
        }, HOLD_THRESHOLD_MS);

        touchStateRef.current.timerId = timerId;
    }, [getWidgetIdFromCoordinates]);

    const handleContainerTouchMove = useCallback((e: TouchEvent) => {
        if (!touchStateRef.current) return;
        if (dragReadyWidgetIdRef.current) return;

        const touch = e.touches[0];
        const { startX, startY, timerId } = touchStateRef.current;
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // CRITICAL: Check distance FIRST, before blocking any events.
        // If user moved beyond threshold, they're scrolling - let it through!
        if (distance > MOVE_THRESHOLD_PX) {
            // Cancel hold timer
            if (timerId) {
                clearTimeout(timerId);
                touchStateRef.current.timerId = null;
            }
            // Cancel hold animation
            if (holdAnimationFrameRef.current) {
                cancelAnimationFrame(holdAnimationFrameRef.current);
                holdAnimationFrameRef.current = null;
            }
            setHoldingWidgetId(null);
            setHoldProgress(0);
            holdStartTimeRef.current = null;
            touchStateRef.current = null;
            // DON'T block - let native scroll happen
            return;
        }

        // Still within threshold (user holding still) - block RGL
        e.stopImmediatePropagation();

        // Update current position for synthetic touch
        touchStateRef.current.currentX = touch.clientX;
        touchStateRef.current.currentY = touch.clientY;
        touchStateRef.current.screenX = touch.screenX;
        touchStateRef.current.screenY = touch.screenY;
        touchStateRef.current.pageX = touch.pageX;
        touchStateRef.current.pageY = touch.pageY;
    }, []);

    const handleContainerTouchEnd = useCallback(() => {
        if (touchStateRef.current?.timerId) {
            clearTimeout(touchStateRef.current.timerId);
            touchStateRef.current.timerId = null;
        }
        // Cancel hold animation if not yet drag-ready
        if (holdAnimationFrameRef.current) {
            cancelAnimationFrame(holdAnimationFrameRef.current);
            holdAnimationFrameRef.current = null;
        }
        // Only clear hold state if we haven't reached drag-ready
        if (!dragReadyWidgetIdRef.current) {
            setHoldingWidgetId(null);
            setHoldProgress(0);
            holdStartTimeRef.current = null;
        }
        touchStateRef.current = null;
    }, []);

    // ========== ATTACH/DETACH NATIVE LISTENERS ==========

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        if (touchBlockingActive) {
            container.addEventListener('touchstart', handleContainerTouchStart, { capture: true, passive: false });
            container.addEventListener('touchmove', handleContainerTouchMove, { capture: true, passive: false });
            container.addEventListener('touchend', handleContainerTouchEnd, { capture: true });
            container.addEventListener('touchcancel', handleContainerTouchEnd, { capture: true });
        }

        return () => {
            container.removeEventListener('touchstart', handleContainerTouchStart, { capture: true } as EventListenerOptions);
            container.removeEventListener('touchmove', handleContainerTouchMove, { capture: true } as EventListenerOptions);
            container.removeEventListener('touchend', handleContainerTouchEnd, { capture: true } as EventListenerOptions);
            container.removeEventListener('touchcancel', handleContainerTouchEnd, { capture: true } as EventListenerOptions);
        };
    }, [touchBlockingActive, handleContainerTouchStart, handleContainerTouchMove, handleContainerTouchEnd]);

    // ========== RESET ==========

    const resetDragReady = useCallback(() => {
        setDragReadyWidgetId(null);
        setHoldingWidgetId(null);
        setHoldProgress(0);
        holdStartTimeRef.current = null;
        if (holdAnimationFrameRef.current) {
            cancelAnimationFrame(holdAnimationFrameRef.current);
            holdAnimationFrameRef.current = null;
        }
        if (autoResetTimerRef.current) {
            clearTimeout(autoResetTimerRef.current);
            autoResetTimerRef.current = null;
        }
        if (touchStateRef.current?.timerId) {
            clearTimeout(touchStateRef.current.timerId);
        }
        touchStateRef.current = null;
        pendingSyntheticTouchRef.current = null;
        allowNextTouchRef.current = false;
    }, []);

    return {
        dragReadyWidgetId,
        holdingWidgetId,
        holdProgress,
        containerRef,
        setTouchBlockingActive,
        resetDragReady,
        isTouchBlockingActive: touchBlockingActive,
    };
}
