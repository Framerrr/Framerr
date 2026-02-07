/**
 * useTouchDrag Hook
 * 
 * Handles mobile touch-based drag-to-reorder for links.
 * iOS-style long-press to start drag, then slide to reorder.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Link, TouchDragRef, TouchDragPosition, LinkGridWidgetConfig } from '../types';
import { GRID_CONSTANTS } from '../types';

interface UseTouchDragProps {
    links: Link[];
    editMode: boolean;
    editingLinkId: string | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
    widgetId?: string;
    config?: LinkGridWidgetConfig;
}

interface UseTouchDragReturn {
    touchDragLinkId: string | null;
    touchDragPosition: TouchDragPosition | null;
    touchDragTargetSlot: number | null;
    handleLinkTouchStart: (e: React.TouchEvent, linkId: string) => void;
    handleLinkTouchMoveLocal: (e: React.TouchEvent) => void;
    handleLinkTouchEndLocal: () => void;
}

export function useTouchDrag({
    links,
    editMode,
    editingLinkId,
    containerRef,
    widgetId,
    config
}: UseTouchDragProps): UseTouchDragReturn {
    const { TOUCH_HOLD_THRESHOLD, MIN_CELL_SIZE, getGridGap } = GRID_CONSTANTS;

    // Touch drag state
    const [touchDragLinkId, setTouchDragLinkId] = useState<string | null>(null);
    const [touchDragPosition, setTouchDragPosition] = useState<TouchDragPosition | null>(null);
    const [touchDragTargetSlot, setTouchDragTargetSlot] = useState<number | null>(null);

    const touchDragRef = useRef<TouchDragRef | null>(null);

    /**
     * Main touch start handler - initiates the drag after hold threshold
     */
    const handleLinkTouchStart = useCallback((e: React.TouchEvent, linkId: string): void => {
        if (!editMode || editingLinkId) return;

        const touch = e.touches[0];
        const originalIndex = links.findIndex(l => l.id === linkId);

        // Clean up any existing drag
        if (touchDragRef.current?.cleanupListeners) {
            touchDragRef.current.cleanupListeners();
        }
        if (touchDragRef.current?.timerId) {
            clearTimeout(touchDragRef.current.timerId);
        }

        // Start tracking
        touchDragRef.current = {
            linkId,
            originalIndex,
            startX: touch.clientX,
            startY: touch.clientY,
            timerId: null,
            isDragging: false,
            cleanupListeners: null,
            currentTargetSlot: originalIndex,
        };

        // Start hold timer - when it completes, start drag
        touchDragRef.current.timerId = setTimeout(() => {
            if (!touchDragRef.current || touchDragRef.current.linkId !== linkId) return;

            touchDragRef.current.isDragging = true;
            setTouchDragLinkId(linkId);
            setTouchDragPosition({ x: touchDragRef.current.startX, y: touchDragRef.current.startY });
            setTouchDragTargetSlot(originalIndex);

            // Calculate slot from center point using fresh grid metrics
            const calculateTargetSlot = (clientX: number, clientY: number): number => {
                const gridContainer = containerRef.current?.querySelector('.relative') as HTMLElement;
                if (!gridContainer) return touchDragRef.current?.originalIndex || 0;

                const gridRect = gridContainer.getBoundingClientRect();
                const relX = clientX - gridRect.left;
                const relY = clientY - gridRect.top;

                // Get fresh grid metrics
                const containerWidth = containerRef.current?.clientWidth || 300;
                const gridGap = getGridGap(containerWidth);
                const freshCols = Math.max(1, Math.floor((containerWidth + gridGap) / (MIN_CELL_SIZE + gridGap)));
                const freshCellSize = Math.floor((containerWidth - (freshCols - 1) * gridGap) / freshCols);
                const cellWithGap = freshCellSize + gridGap;

                // Calculate which slot the CENTER of the drag is over
                const col = Math.floor(relX / cellWithGap);
                const row = Math.floor(relY / cellWithGap);

                // Clamp to valid range
                const slot = Math.max(0, Math.min(links.length - 1, row * freshCols + col));
                return slot;
            };

            const handleDocTouchMove = (ev: TouchEvent): void => {
                if (!touchDragRef.current?.isDragging) return;

                const t = ev.touches[0];
                if (ev.cancelable) ev.preventDefault(); // Prevent scroll

                // Update floating preview position
                setTouchDragPosition({ x: t.clientX, y: t.clientY });

                // Calculate target slot from center point
                const newSlot = calculateTargetSlot(t.clientX, t.clientY);

                // Only update if slot actually changed
                if (newSlot !== touchDragRef.current.currentTargetSlot) {
                    touchDragRef.current.currentTargetSlot = newSlot;
                    setTouchDragTargetSlot(newSlot);
                }
            };

            const handleDocTouchEnd = (): void => {
                if (!touchDragRef.current) return;

                const { originalIndex, currentTargetSlot } = touchDragRef.current;

                // Only reorder if position actually changed
                if (currentTargetSlot !== originalIndex) {
                    const newLinks = [...links];
                    const [draggedItem] = newLinks.splice(originalIndex, 1);
                    newLinks.splice(currentTargetSlot, 0, draggedItem);

                    // Dispatch event to update Dashboard's local state
                    window.dispatchEvent(new CustomEvent('widget-config-changed', {
                        detail: {
                            widgetId,
                            config: { ...config, links: newLinks }
                        }
                    }));
                }

                // Clean up state
                setTouchDragLinkId(null);
                setTouchDragPosition(null);
                setTouchDragTargetSlot(null);

                if (touchDragRef.current?.cleanupListeners) {
                    touchDragRef.current.cleanupListeners();
                }
                touchDragRef.current = null;
            };

            document.addEventListener('touchmove', handleDocTouchMove, { passive: false });
            document.addEventListener('touchend', handleDocTouchEnd);
            document.addEventListener('touchcancel', handleDocTouchEnd);

            // Store cleanup function
            if (touchDragRef.current) {
                touchDragRef.current.cleanupListeners = () => {
                    document.removeEventListener('touchmove', handleDocTouchMove);
                    document.removeEventListener('touchend', handleDocTouchEnd);
                    document.removeEventListener('touchcancel', handleDocTouchEnd);
                };
            }
        }, TOUCH_HOLD_THRESHOLD);
    }, [editMode, editingLinkId, links, containerRef, widgetId, config, TOUCH_HOLD_THRESHOLD, MIN_CELL_SIZE, getGridGap]);

    /**
     * Cancel drag if user moves before threshold
     */
    const handleLinkTouchMoveLocal = useCallback((e: React.TouchEvent): void => {
        if (!touchDragRef.current || touchDragRef.current.isDragging) return;

        const touch = e.touches[0];
        const { startX, startY, timerId } = touchDragRef.current;
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);

        if (deltaX > 10 || deltaY > 10) {
            // Moved too much, cancel the hold timer
            if (timerId) clearTimeout(timerId);
            touchDragRef.current = null;
        }
    }, []);

    /**
     * Cancel drag if user lifts before threshold
     */
    const handleLinkTouchEndLocal = useCallback((): void => {
        if (touchDragRef.current && !touchDragRef.current.isDragging) {
            if (touchDragRef.current.timerId) {
                clearTimeout(touchDragRef.current.timerId);
            }
            touchDragRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (touchDragRef.current?.cleanupListeners) {
                touchDragRef.current.cleanupListeners();
            }
            if (touchDragRef.current?.timerId) {
                clearTimeout(touchDragRef.current.timerId);
            }
        };
    }, []);

    return {
        touchDragLinkId,
        touchDragPosition,
        touchDragTargetSlot,
        handleLinkTouchStart,
        handleLinkTouchMoveLocal,
        handleLinkTouchEndLocal
    };
}

export default useTouchDrag;
