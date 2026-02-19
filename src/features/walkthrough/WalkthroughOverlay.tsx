/**
 * WalkthroughOverlay — Presentation Layer
 *
 * Renders the SVG spotlight, walkthrough card, and confirmation dialog.
 * All interaction logic is delegated to useWalkthroughInteraction.
 *
 * Uses position:fixed with getBoundingClientRect() for positioning.
 * SVG overlay with fill-rule="evenodd" creates rounded spotlight cutout.
 *
 * Step phase gating:
 * - ENTERING: click blocker ON, SVG + card HIDDEN (user sees raw UI)
 * - ACTIVE:   click blocker ON, SVG + card VISIBLE, sonar ring PULSING
 * - EXITING:  click blocker ON, SVG + card FADING OUT
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useWalkthrough } from './WalkthroughContext';
import { useWalkthroughInteraction } from './useWalkthroughInteraction';
import WalkthroughCard from './WalkthroughCard';
import WalkthroughConfirmDialog from './WalkthroughConfirmDialog';
import logger from '../../utils/logger';
import './styles.css';

// ─── SVG Spotlight ───────────────────────────────────────────────────

const CUTOUT_PADDING = 6;

function buildSpotlightPath(
    rect: DOMRect,
    vw: number,
    vh: number,
    borderRadius: number,
): string {
    const x = rect.left - CUTOUT_PADDING;
    const y = rect.top - CUTOUT_PADDING;
    const w = rect.width + CUTOUT_PADDING * 2;
    const h = rect.height + CUTOUT_PADDING * 2;
    const r = Math.min(borderRadius + CUTOUT_PADDING, w / 2, h / 2);

    const outer = `M0 0 H${vw} V${vh} H0 Z`;
    const inner = [
        `M${x + r} ${y}`,
        `H${x + w - r}`,
        `a${r} ${r} 0 0 1 ${r} ${r}`,
        `V${y + h - r}`,
        `a${r} ${r} 0 0 1 -${r} ${r}`,
        `H${x + r}`,
        `a${r} ${r} 0 0 1 -${r} -${r}`,
        `V${y + r}`,
        `a${r} ${r} 0 0 1 ${r} -${r}`,
        'Z',
    ].join(' ');

    return `${outer} ${inner}`;
}

// ─── Card Position Calculation ───────────────────────────────────────

const CARD_OFFSET = 16; // gap between target and card
const CARD_WIDTH = 400;
const CARD_ESTIMATED_HEIGHT = 200;

interface CardPosition {
    top: number;
    left: number;
    placement: 'top' | 'bottom';
}

/**
 * Calculate card position using position:fixed coordinates.
 * Prefers placing card below the target; flips above if not enough space.
 * Shifts horizontally to stay on-screen.
 */
function calculateCardPosition(targetRect: DOMRect): CardPosition {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Decide vertical placement: prefer bottom, flip to top if needed
    const spaceBelow = vh - targetRect.bottom - CARD_OFFSET;
    const spaceAbove = targetRect.top - CARD_OFFSET;
    const placement: 'top' | 'bottom' =
        spaceBelow >= CARD_ESTIMATED_HEIGHT ? 'bottom'
            : spaceAbove >= CARD_ESTIMATED_HEIGHT ? 'top'
                : 'bottom'; // fallback to bottom

    const top = placement === 'bottom'
        ? targetRect.bottom + CARD_OFFSET
        : targetRect.top - CARD_ESTIMATED_HEIGHT - CARD_OFFSET;

    // Horizontal: center card under target, shift to stay on-screen
    let left = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2;
    left = Math.max(16, Math.min(left, vw - CARD_WIDTH - 16));

    return { top, left, placement };
}

// ─── Arrow Position ──────────────────────────────────────────────────

function calculateArrowPosition(
    targetRect: DOMRect,
    cardLeft: number,
    placement: 'top' | 'bottom',
): { left: number; side: 'top' | 'bottom' } {
    // Arrow points at the center of the target, clamped within card width
    const targetCenter = targetRect.left + targetRect.width / 2;
    const arrowLeft = Math.max(20, Math.min(targetCenter - cardLeft, CARD_WIDTH - 20));

    return {
        left: arrowLeft,
        side: placement === 'bottom' ? 'top' : 'bottom',
    };
}


// ─── Card Animation ──────────────────────────────────────────────────

const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
};

const TRANSITION = {
    duration: 0.22,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

// ─── Main Overlay Component ──────────────────────────────────────────

const WalkthroughOverlay: React.FC = () => {
    const walkthrough = useWalkthrough();
    const cardContainerRef = useRef<HTMLDivElement>(null);
    const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
    const [svgPath, setSvgPath] = useState<string>('');
    const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });
    const [cardPos, setCardPos] = useState<CardPosition | null>(null);
    const [fallbackToCentered, setFallbackToCentered] = useState(false);
    const prevStepModeRef = useRef<'centered' | 'anchored' | null>(null);

    const currentStep = walkthrough?.currentStep;
    const stepPhase = walkthrough?.stepPhase ?? 'entering';
    const stepIndex = walkthrough?.state.currentStepIndex ?? 0;
    const isCentered = currentStep?.mode === 'centered' || fallbackToCentered;
    const isActive = walkthrough?.state.isActive ?? false;

    // ─── Synchronous state clearing on step change ───────────────────
    // React pattern: setState during render to clear stale position data
    // BEFORE the JSX evaluates. Without this, useEffect clearing runs
    // AFTER render, causing one frame with stale cardPos from the
    // previous step (the 0,0 flash).
    const [prevStepIndex, setPrevStepIndex] = useState(stepIndex);
    if (stepIndex !== prevStepIndex) {
        // prevStepModeRef still holds the OLD step's mode here (set at end of render cycle)
        setPrevStepIndex(stepIndex);
        setTargetEl(null);
        setCardPos(null);
        setFallbackToCentered(false);
        // Clear SVG for centered steps or steps that explicitly request a spotlight reset.
        // Default: keep old cutout path so spotlight morphs to new position.
        if (currentStep?.mode === 'centered' || currentStep?.spotlightTransition === 'reset') {
            setSvgPath('');
        }
    }

    // Determine if we're morphing between anchored steps
    // When morphing, keep SVG at full opacity during entering phase
    const isMorphing = prevStepModeRef.current === 'anchored' && currentStep?.mode === 'anchored'
        && currentStep.spotlightTransition !== 'reset';

    // When morphing anchored→anchored, treat 'entering' as 'active' so
    // the card, ring, and SVG show immediately (no fade-out gap).
    const effectivePhase = (isMorphing && stepPhase === 'entering') ? 'active' : stepPhase;
    // Update ref with current step's effective mode (for next transition detection)
    // This runs at the end of the render, so it captures the current step's mode
    // AFTER all the synchronous clearing above.
    prevStepModeRef.current = isCentered ? 'centered' : (currentStep?.mode ?? null);

    // ─── Find target element (waits for position stability) ──────────
    useEffect(() => {
        setTargetEl(null);
        setCardPos(null);
        setFallbackToCentered(false);

        if (!currentStep || currentStep.mode !== 'anchored') return;

        // Dispatch beforeEnter event for app-specific cleanup (e.g., close modals, save)
        if (currentStep.beforeEnter) {
            window.dispatchEvent(new CustomEvent(currentStep.beforeEnter));
        }

        // Navigate to target page if step requires it
        if (currentStep.navigateTo) {
            const targetHash = currentStep.navigateTo.replace(/^#/, '');
            const currentHash = window.location.hash.replace(/^#/, '');
            if (currentHash !== targetHash) {
                window.location.hash = targetHash;
            }
        }

        // Resolve dynamic selector (function receives step data)
        const rawSelector = currentStep.targetSelector;
        if (!rawSelector) return;
        const selector = typeof rawSelector === 'function'
            ? rawSelector(walkthrough?.state.stepData ?? {})
            : rawSelector;
        if (!selector) return;

        let cancelled = false;
        let rafId: number;

        // Timeout: if target isn't found within 3 seconds, fall back to centered
        const fallbackTimer = setTimeout(() => {
            if (!cancelled) {
                logger.debug(`[Walkthrough] Target '${selector}' not found after 3s, falling back to centered`);
                setFallbackToCentered(true);
            }
        }, 3000);

        const waitForStableTarget = () => {
            if (cancelled) return;

            const el = document.querySelector<HTMLElement>(selector);
            // Element must exist AND have non-zero dimensions.
            // Elements inside collapsed overflow:hidden parents (like
            // the edit bar during height:0→auto animation) exist in DOM
            // but have zero height — we must wait for them to expand.
            const rect = el?.getBoundingClientRect();
            if (!el || !rect || rect.width < 1 || rect.height < 1) {
                rafId = requestAnimationFrame(waitForStableTarget);
                return;
            }

            // Target found — clear the fallback timer
            clearTimeout(fallbackTimer);

            // Wait for position to stabilize (3 consecutive stable frames)
            let prevRect = el.getBoundingClientRect();
            let stableFrames = 0;

            const checkStability = () => {
                if (cancelled) return;
                const rect = el.getBoundingClientRect();
                const moved = Math.abs(rect.top - prevRect.top) > 0.5
                    || Math.abs(rect.left - prevRect.left) > 0.5;

                if (moved) {
                    stableFrames = 0;
                    prevRect = rect;
                } else {
                    stableFrames++;
                }

                if (stableFrames >= 3) {
                    // Stable — set target and calculate card position
                    const pos = calculateCardPosition(rect);
                    setTargetEl(el);
                    setCardPos(pos);
                } else {
                    rafId = requestAnimationFrame(checkStability);
                }
            };

            rafId = requestAnimationFrame(checkStability);
        };

        rafId = requestAnimationFrame(waitForStableTarget);
        return () => { cancelled = true; cancelAnimationFrame(rafId); clearTimeout(fallbackTimer); };
    }, [currentStep]);

    // ─── SVG spotlight + card position tracking (RAF loop) ───────────
    useEffect(() => {
        if (!targetEl) {
            // Only clear SVG when step is centered (no target expected).
            // When transitioning between anchored steps, keep the old cutout
            // path so the spotlight appears to morph instead of flashing.
            if (isCentered) {
                setSvgPath('');
            }
            return;
        }

        let rafId: number;
        const update = () => {
            // If target was removed from DOM (e.g. popover closes between steps),
            // keep the SVG cutout at its last position so it morphs to the new target
            // instead of flashing. Only hide the card.
            if (!document.contains(targetEl)) {
                setCardPos(null);
                return; // Stop RAF loop — svgPath stays at last known position
            }

            const rect = targetEl.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const computedRadius = parseFloat(window.getComputedStyle(targetEl).borderRadius) || 0;
            setSvgPath(buildSpotlightPath(rect, vw, vh, computedRadius));
            setViewportSize({ w: vw, h: vh });

            // Also update card position (handles resize/scroll)
            setCardPos(calculateCardPosition(rect));

            rafId = requestAnimationFrame(update);
        };
        update();

        return () => cancelAnimationFrame(rafId);
    }, [targetEl]);

    // ─── Spotlight glow ring ─────────────────────────────────────────
    useEffect(() => {
        if (!targetEl) return;
        targetEl.classList.add('walkthrough-target-spotlight');
        if (effectivePhase === 'active') {
            targetEl.classList.add('walkthrough-sonar-active');
        }
        return () => {
            targetEl.classList.remove('walkthrough-target-spotlight');
            targetEl.classList.remove('walkthrough-sonar-active');
        };
    }, [targetEl, effectivePhase]);

    // ─── Cleanup on walkthrough end ──────────────────────────────────
    useEffect(() => {
        if (!isActive) {
            document.querySelectorAll('.walkthrough-target-spotlight').forEach((el) => {
                el.classList.remove('walkthrough-target-spotlight');
                el.classList.remove('walkthrough-sonar-active');
            });
        }
    }, [isActive]);

    // ─── Interaction hook (click blocking, drag, confirmation) ───────
    const handleDragFailed = useCallback(() => {
        // Dispatch event for Dashboard to reopen modal
        window.dispatchEvent(new CustomEvent('walkthrough-reopen-modal'));
        // Try to find the modal immediately (it stays in DOM during walkthrough)
        const modalEl = document.querySelector<HTMLElement>('.add-widget-modal');
        if (modalEl) {
            setTargetEl(modalEl);
            return;
        }
        // Fallback: wait for the modal to appear in DOM
        const observer = new MutationObserver(() => {
            const el = document.querySelector<HTMLElement>('.add-widget-modal');
            if (el) {
                setTargetEl(el);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 2000);
    }, []);

    // Auto-advance when user clicks the spotlighted target on action-type steps
    const handleTargetClick = useCallback(() => {
        if (currentStep?.advanceOn.type === 'action') {
            walkthrough?.advance();
        }
    }, [currentStep, walkthrough]);

    const isSuspended = walkthrough?.state.suspended ?? false;

    const {
        isDragging,
        dragTargetEl,
        showEndConfirmation,
        setShowEndConfirmation,
    } = useWalkthroughInteraction({
        isActive: isActive && !isSuspended,
        currentStep: currentStep ?? null,
        stepPhase,
        targetEl,
        cardContainerRef: cardContainerRef as React.RefObject<HTMLDivElement>,
        onTargetClick: handleTargetClick,
        onDragFailed: handleDragFailed,
    });

    // ─── Switch SVG target during drag ───────────────────────────────
    useEffect(() => {
        if (isDragging && dragTargetEl) {
            setTargetEl(dragTargetEl);
        }
    }, [isDragging, dragTargetEl]);

    // ─── Keyboard ────────────────────────────────────────────────────
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
            e.preventDefault();
            walkthrough?.resetAndStartFlow('onboarding');
            return;
        }
        if (!walkthrough?.state.isActive) return;
        if (e.key === 'Escape') walkthrough.skip();
        else if (e.key === 'Enter' && walkthrough.currentStep?.advanceOn.type === 'button') {
            walkthrough.advance();
        }
    }, [walkthrough]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // ─── Render gate ─────────────────────────────────────────────────
    if (!isActive || !currentStep || walkthrough?.state.suspended) return null;

    const { totalSteps, currentStepNumber } = walkthrough;
    const isFirst = currentStepNumber === 1;
    const isLast = currentStepNumber === totalSteps;

    // Arrow calculation (only when card + target are ready)
    const arrowInfo = cardPos && targetEl
        ? calculateArrowPosition(targetEl.getBoundingClientRect(), cardPos.left, cardPos.placement)
        : null;

    return (
        <>
            {/* SVG Overlay — hidden during entering phase, visible during active, fading during exiting */}
            <svg
                className={`walkthrough-svg-overlay ${(effectivePhase === 'entering') ? 'walkthrough-phase-entering' : effectivePhase === 'exiting' ? 'walkthrough-phase-exiting' : 'walkthrough-phase-active'}`}
                viewBox={`0 0 ${viewportSize.w} ${viewportSize.h}`}
                xmlns="http://www.w3.org/2000/svg"
                style={{ pointerEvents: 'none' }}
            >
                {svgPath ? (
                    <path d={svgPath} fill="rgba(0, 0, 0, 0.55)" fillRule="evenodd"
                        style={{ pointerEvents: 'auto' }} />
                ) : (
                    <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.55)"
                        style={{ pointerEvents: 'auto' }} />
                )}
            </svg>

            {/* Card — gated by step phase + hideCard flag */}
            <div ref={cardContainerRef}>
                {effectivePhase !== 'active' || currentStep.hideCard ? null : isCentered ? (
                    /* Centered step — fixed position, no target needed */
                    <div className="walkthrough-centered-card">
                        <motion.div
                            key={`centered-${stepIndex}`}
                            variants={cardVariants}
                            initial="hidden"
                            animate="visible"
                            transition={TRANSITION}
                        >
                            <WalkthroughCard
                                step={currentStep}
                                stepNumber={currentStepNumber}
                                totalSteps={totalSteps}
                                onNext={walkthrough.advance}
                                onSkip={walkthrough.skip}
                                isFirst={isFirst}
                                isLast={isLast}
                            />
                        </motion.div>
                    </div>
                ) : cardPos ? (
                    /* Anchored step — position:fixed with calculated coordinates.
                       Only renders when cardPos exists (never at 0,0). */
                    <div
                        key={`anchored-${stepIndex}`}
                        className="walkthrough-floating-container"
                        style={{
                            position: 'fixed',
                            top: cardPos.top,
                            left: cardPos.left,
                            width: CARD_WIDTH,
                            maxWidth: 'calc(100vw - 32px)',
                        }}
                    >
                        <motion.div
                            variants={cardVariants}
                            initial="hidden"
                            animate="visible"
                            transition={TRANSITION}
                        >
                            <WalkthroughCard
                                step={currentStep}
                                stepNumber={currentStepNumber}
                                totalSteps={totalSteps}
                                onNext={walkthrough.advance}
                                onSkip={walkthrough.skip}
                                isFirst={isFirst}
                                isLast={isLast}
                            />
                        </motion.div>

                        {/* Arrow pointing at target */}
                        {arrowInfo && (
                            <div
                                className="walkthrough-arrow"
                                style={{
                                    left: arrowInfo.left,
                                    [arrowInfo.side === 'top' ? 'top' : 'bottom']: '-6px',
                                }}
                            />
                        )}
                    </div>
                ) : null}

                {/* End Walkthrough Confirmation Dialog */}
                <WalkthroughConfirmDialog
                    isVisible={showEndConfirmation}
                    onCancel={() => setShowEndConfirmation(false)}
                    onConfirm={() => {
                        setShowEndConfirmation(false);
                        walkthrough.skip();
                    }}
                />
            </div>
        </>
    );
};

export default WalkthroughOverlay;
