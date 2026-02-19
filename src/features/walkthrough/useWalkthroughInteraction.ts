/**
 * useWalkthroughInteraction
 * 
 * Handles all user interaction logic for the walkthrough engine:
 * - Capture-phase click blocking (reads step.interaction config)
 * - Drag awareness (configurable drag class via step config)
 * - End-confirmation trigger (from blocked selector clicks)
 * 
 * This hook owns NO presentation logic — it tells the overlay
 * what to do via returned state values.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WalkthroughStep, StepPhase } from './types';

interface UseWalkthroughInteractionProps {
    /** Whether the walkthrough is actively running */
    isActive: boolean;
    /** Current step definition */
    currentStep: WalkthroughStep | null;
    /** Current step phase */
    stepPhase: StepPhase;
    /** The current target element (for allowing clicks on it) */
    targetEl: HTMLElement | null;
    /** Ref to the walkthrough card container (always clickable) */
    cardContainerRef: React.RefObject<HTMLDivElement>;
    /** Called when the user clicks the target element (for auto-advance on action steps) */
    onTargetClick: () => void;
    /** Called when a drag-failed is detected (drop outside valid zone) */
    onDragFailed: () => void;
}

interface UseWalkthroughInteractionReturn {
    /** Whether a drag operation is in progress */
    isDragging: boolean;
    /** The element the SVG should target during drag (e.g., grid) */
    dragTargetEl: HTMLElement | null;
    /** Whether the end-confirmation dialog should show */
    showEndConfirmation: boolean;
    /** Setter for end-confirmation dialog visibility */
    setShowEndConfirmation: (show: boolean) => void;
}

export function useWalkthroughInteraction({
    isActive,
    currentStep,
    stepPhase,
    targetEl,
    cardContainerRef,
    onTargetClick,
    onDragFailed,
}: UseWalkthroughInteractionProps): UseWalkthroughInteractionReturn {
    const [showEndConfirmation, setShowEndConfirmation] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragTargetEl, setDragTargetEl] = useState<HTMLElement | null>(null);
    const isDraggingRef = useRef(false);
    const stepAdvancedRef = useRef(false);

    // Listen for synchronous advance signal from WalkthroughContext.
    // This fires immediately when advance() is called (before React renders),
    // so the drag-awareness RAF callback always sees the correct value.
    useEffect(() => {
        const handler = () => {
            stepAdvancedRef.current = true;
        };
        window.addEventListener('walkthrough-step-advanced', handler);
        return () => window.removeEventListener('walkthrough-step-advanced', handler);
    }, []);

    // ─── Capture-phase click blocker ─────────────────────────────────
    // Blocks all clicks OUTSIDE the target element and walkthrough card.
    // The target element itself is fully unblocked — its onClick fires
    // normally. A separate bubble-phase listener (below) handles advance.
    useEffect(() => {
        if (!isActive) return;

        const interaction = currentStep?.interaction;

        const handler = (e: MouseEvent) => {
            const target = e.target as Node;

            // During drag operations with dragAware steps, allow all events
            // so drag libraries (GridStack, etc.) function properly
            if (isDraggingRef.current && interaction?.dragAware) return;

            // Always allow clicks on the walkthrough card container
            if (cardContainerRef.current?.contains(target)) return;

            // During entering/exiting phases, block EVERYTHING except the card
            if (stepPhase !== 'active') {
                e.stopPropagation();
                e.preventDefault();
                return;
            }

            // Check blocked selectors FIRST — they may be inside allowed zones
            // (e.g., modal X button is inside the modal)
            if (interaction?.block) {
                for (const sel of interaction.block) {
                    const blockedEl = document.querySelector(sel);
                    if (blockedEl?.contains(target)) {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowEndConfirmation(true);
                        return;
                    }
                }
            }

            // Allow clicks on the walkthrough target element — fully unblocked
            if (targetEl?.contains(target)) {
                return;
            }

            // Check allowed selectors (e.g., modal body during interactive steps)
            if (interaction?.allow) {
                for (const sel of interaction.allow) {
                    const zone = document.querySelector(sel);
                    if (zone?.contains(target)) return;
                }
            }

            // Everything else is blocked
            e.stopPropagation();
            e.preventDefault();
        };

        // Capture phase — intercepts before any other handlers
        document.addEventListener('click', handler, true);
        document.addEventListener('mousedown', handler, true);
        document.addEventListener('mouseup', handler, true);
        document.addEventListener('pointerdown', handler, true);
        document.addEventListener('pointerup', handler, true);

        return () => {
            document.removeEventListener('click', handler, true);
            document.removeEventListener('mousedown', handler, true);
            document.removeEventListener('mouseup', handler, true);
            document.removeEventListener('pointerdown', handler, true);
            document.removeEventListener('pointerup', handler, true);
        };
    }, [isActive, currentStep, stepPhase, targetEl, cardContainerRef]);

    // ─── Bubble-phase target click listener (for action steps) ───────
    // Attaches directly to the target element. Fires AFTER the button's
    // own onClick, so the button works normally (modal opens, etc.) and
    // THEN the walkthrough advances. No timing hacks needed.
    useEffect(() => {
        if (!isActive || !targetEl || currentStep?.advanceOn.type !== 'action') return;
        if (stepPhase !== 'active') return;

        const handler = () => {
            onTargetClick();
        };

        targetEl.addEventListener('click', handler);
        return () => targetEl.removeEventListener('click', handler);
    }, [isActive, targetEl, currentStep, stepPhase, onTargetClick]);

    // ─── Drag awareness ──────────────────────────────────────────────
    useEffect(() => {
        if (!isActive || !currentStep?.interaction?.dragAware) return;

        const dragClass = currentStep.interaction.dragClass;
        const dragTargetSelector = currentStep.interaction.dragTargetSelector;
        if (!dragClass) return;

        // Track the drag element so we can detect its removal
        let activeDragNode: HTMLElement | null = null;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;

                // Detect drag START: `.ui-draggable-dragging` element added to DOM
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    if (!node.classList.contains(dragClass)) continue;

                    // Drag started — switch SVG target and relax blocker
                    activeDragNode = node;
                    isDraggingRef.current = true;
                    stepAdvancedRef.current = false;
                    setIsDragging(true);

                    // Find the drag target element (e.g., dashboard grid)
                    if (dragTargetSelector) {
                        const gridEl = document.querySelector<HTMLElement>(dragTargetSelector);
                        if (gridEl) {
                            setDragTargetEl(gridEl);
                        }
                    }
                    return;
                }

                // Detect drag END: `.ui-draggable-dragging` element removed from DOM
                // This is more reliable than mouseup because GridStack controls the
                // element lifecycle — works even if cursor leaves the window.
                if (!activeDragNode) continue;
                for (const node of mutation.removedNodes) {
                    if (node !== activeDragNode) continue;

                    activeDragNode = null;
                    // Use rAF to check if the step already advanced
                    // (emit('widget-added') runs synchronously in GridStack's drop callback)
                    requestAnimationFrame(() => {
                        if (stepAdvancedRef.current) {
                            // Success — step already advanced, clean up
                            isDraggingRef.current = false;
                            setIsDragging(false);
                            setDragTargetEl(null);
                        } else {
                            // Failed drop — widget was NOT added
                            isDraggingRef.current = false;
                            setIsDragging(false);
                            setDragTargetEl(null);
                            onDragFailed();
                        }
                    });
                    return;
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [isActive, currentStep, onDragFailed]);

    // Clean up drag state when step changes or walkthrough ends
    useEffect(() => {
        if (!isActive) {
            isDraggingRef.current = false;
            setIsDragging(false);
            setDragTargetEl(null);
        }
    }, [isActive]);

    // Reset confirmation dialog on step change
    useEffect(() => {
        setShowEndConfirmation(false);
    }, [currentStep?.id]);

    return {
        isDragging,
        dragTargetEl,
        showEndConfirmation,
        setShowEndConfirmation,
    };
}
