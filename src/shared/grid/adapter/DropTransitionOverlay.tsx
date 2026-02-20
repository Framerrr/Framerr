/**
 * DropTransitionOverlay - Seamless FLIP animation for external widget drops
 *
 * When a widget is dropped from the modal onto the grid, this component:
 * 1. Creates a fixed-position overlay at the drop position (helperRect)
 * 2. Renders the SAME widget component the grid will use (via renderWidget)
 * 3. Slides the overlay from drop position → grid cell position (FLIP animation)
 * 4. Waits for the real grid widget to render (via MutationObserver)
 * 5. Crossfades: overlay fades out, grid cell fades in
 * 6. Self-cleans after transition completes
 *
 * This replaces the previous vanilla DOM overlay approach, which used a frozen
 * DOM snapshot (morph-content) that couldn't match the real widget's rendering.
 */

import React, { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getWidgetMetadata } from '../../../widgets/registry';
import { resolveAutoBinding } from '../../../widgets/resolveAutoBinding';
import { useRoleAwareIntegrations } from '../../../api/hooks/useIntegrations';
import type { FramerrWidget } from '../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface DropTransitionEvent {
    /** Bounding rect of the drag helper at the moment of drop */
    helperRect: DOMRect;
    /** Bounding rect of the grid cell content area (target position) */
    gridRect: DOMRect;
    /** Widget type (e.g. 'clock', 'plex') */
    widgetType: string;
    /** Widget ID assigned by onDropped (temporary -drop suffix) */
    widgetId: string;
    /** The content element in the grid cell (controls opacity for crossfade) */
    contentEl: HTMLElement;
    /** Ref to updatePortalContainers for retry resilience */
    retryPortalUpdate?: () => void;
}

interface OverlayState {
    event: DropTransitionEvent;
    phase: 'slide' | 'crossfade' | 'done';
}

export interface DropTransitionOverlayProps {
    /** Same renderWidget function the grid uses */
    renderWidget: (widget: FramerrWidget) => ReactNode;
    /** Transform scale factor (for template builder scaled grids, default 1) */
    transformScale?: number;
}

// ============================================================================
// CUSTOM EVENT NAME
// ============================================================================

export const DROP_TRANSITION_EVENT = 'widget-drop-animate';

// ============================================================================
// COMPONENT
// ============================================================================

export function DropTransitionOverlay({ renderWidget, transformScale = 1 }: DropTransitionOverlayProps): React.ReactElement | null {
    const [overlay, setOverlay] = useState<OverlayState | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const cleanupTimersRef = useRef<number[]>([]);
    const observerRef = useRef<MutationObserver | null>(null);

    // Cleanup all timers and observers
    const cleanupAll = useCallback(() => {
        for (const id of cleanupTimersRef.current) {
            clearTimeout(id);
        }
        cleanupTimersRef.current = [];
        observerRef.current?.disconnect();
        observerRef.current = null;
    }, []);

    // Listen for drop transition events
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<DropTransitionEvent>).detail;
            if (!detail) return;

            // Clean up any existing overlay
            cleanupAll();

            // Start new overlay
            setOverlay({
                event: detail,
                phase: 'slide',
            });
        };

        window.addEventListener(DROP_TRANSITION_EVENT, handler);
        return () => {
            window.removeEventListener(DROP_TRANSITION_EVENT, handler);
            cleanupAll();
        };
    }, [cleanupAll]);

    // Safety net: if the user starts dragging any widget while the overlay
    // is still visible, dismiss it immediately to prevent a visual clone.
    useEffect(() => {
        if (!overlay) return;

        const mainGrid = document.querySelector('.grid-stack-main');
        if (!mainGrid) return;

        const onDragStart = () => {
            cleanupAll();
            setOverlay(null);
        };

        // GridStack fires 'dragstart' on the grid element
        mainGrid.addEventListener('dragstart', onDragStart);
        return () => mainGrid.removeEventListener('dragstart', onDragStart);
    }, [overlay, cleanupAll]);

    // Handle animation phases
    useEffect(() => {
        if (!overlay || overlay.phase === 'done') return undefined;

        const { event } = overlay;
        const overlayEl = overlayRef.current;
        let rafId: number | undefined;

        if (overlay.phase === 'slide' && overlayEl) {
            // Phase 1: Slide from helperRect to gridRect
            // Use rAF to ensure the initial position is painted before transitioning
            rafId = requestAnimationFrame(() => {
                overlayEl.style.left = `${event.gridRect.left}px`;
                overlayEl.style.top = `${event.gridRect.top}px`;
                overlayEl.style.width = `${event.gridRect.width}px`;
                overlayEl.style.height = `${event.gridRect.height}px`;
            });

            // After slide completes (300ms), start crossfade phase
            const slideTimer = window.setTimeout(() => {
                setOverlay(prev => prev ? { ...prev, phase: 'crossfade' } : null);
            }, 320); // Slightly more than the 300ms transition

            cleanupTimersRef.current.push(slideTimer);
        }

        if (overlay.phase === 'crossfade') {
            // Phase 2: Wait for the real grid widget to paint, then crossfade
            const portalTarget = event.contentEl.querySelector(`[data-widget-portal="${event.widgetId}"]`);

            const executeCrossfade = () => {
                // Reveal the grid cell content (both opacity and visibility)
                event.contentEl.style.visibility = 'visible';
                event.contentEl.style.opacity = '1';

                // Fade out the overlay
                if (overlayRef.current) {
                    overlayRef.current.style.opacity = '0';
                }

                // Remove overlay after fade-out completes
                const removeTimer = window.setTimeout(() => {
                    setOverlay(null);
                    cleanupAll();
                }, 130); // Match the 100ms opacity transition + buffer
                cleanupTimersRef.current.push(removeTimer);
            };

            // Check if portal already has painted content
            const hasContent = portalTarget && portalTarget.children.length > 0;
            if (hasContent) {
                executeCrossfade();
            } else {
                // Watch for portal content to appear via MutationObserver
                if (portalTarget) {
                    observerRef.current = new MutationObserver((mutations) => {
                        for (const mutation of mutations) {
                            if (mutation.addedNodes.length > 0) {
                                observerRef.current?.disconnect();
                                observerRef.current = null;
                                // Small delay to let React complete its paint
                                const paintTimer = window.setTimeout(executeCrossfade, 16);
                                cleanupTimersRef.current.push(paintTimer);
                                return;
                            }
                        }
                    });
                    observerRef.current.observe(portalTarget, { childList: true });
                }

                // Fallback: The sync effect removes the original drop element and re-adds
                // a new one, so event.contentEl is now detached and the observer above
                // will never fire. However, the NEW element is already visible behind the
                // overlay. We just need a very short delay for React to paint the portal
                // content, then crossfade (fade out the overlay).
                const fallbackTimer = window.setTimeout(() => {
                    observerRef.current?.disconnect();
                    observerRef.current = null;
                    executeCrossfade();
                }, 25);
                cleanupTimersRef.current.push(fallbackTimer);
            }
        }

        return () => {
            if (rafId !== undefined) cancelAnimationFrame(rafId);
            observerRef.current?.disconnect();
        };
    }, [overlay, cleanupAll]);

    // Cleanup on unmount
    useEffect(() => {
        return () => cleanupAll();
    }, [cleanupAll]);

    // ========== INTEGRATION BINDING ==========

    // Get all integrations from React Query cache (no new API calls)
    const { data: allIntegrations = [] } = useRoleAwareIntegrations();

    // ========== RENDER ==========

    if (!overlay) return null;

    const { event } = overlay;

    // Resolve auto-binding via shared function
    const autoBinding = resolveAutoBinding(event.widgetType, allIntegrations);

    // Build a widget object matching what the grid will render
    const metadata = getWidgetMetadata(event.widgetType);
    const widgetData: FramerrWidget = {
        id: event.widgetId,
        type: event.widgetType,
        config: {
            ...metadata?.defaultConfig,
            title: metadata?.name,
            ...autoBinding,
        },
        layout: {
            x: 0,
            y: 0,
            w: metadata?.defaultSize?.w || 4,
            h: metadata?.defaultSize?.h || 2,
        },
    };

    // Use createPortal to render at document.body level.
    // This is critical for the template builder where the grid is inside a
    // CSS transform: scale() container. Per CSS spec, position:fixed elements
    // inside a transformed ancestor use that ancestor as containing block,
    // causing double-scaling and wrong positioning.
    return createPortal(
        <div
            ref={overlayRef}
            style={{
                position: 'fixed',
                zIndex: 9997,
                left: event.helperRect.left,
                top: event.helperRect.top,
                width: event.helperRect.width,
                height: event.helperRect.height,
                borderRadius: '1rem',
                overflow: 'hidden',
                pointerEvents: 'none',
                transition: `
                    left 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                    top 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                    width 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                    height 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                    opacity 0.1s ease-out
                `,
            }}
        >
            <div style={{
                width: transformScale < 1 ? `${100 / transformScale}%` : '100%',
                height: transformScale < 1 ? `${100 / transformScale}%` : '100%',
                overflow: 'hidden',
                transform: transformScale < 1 ? `scale(${transformScale})` : undefined,
                transformOrigin: 'top left',
            }}>
                {renderWidget(widgetData)}
            </div>
        </div>,
        document.body
    );
}

export default DropTransitionOverlay;
