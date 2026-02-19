import { useEffect, useRef } from 'react';

/**
 * useScrollLock - Prevents page scrolling when modal/overlay is open
 * 
 * iOS Safari Compatible:
 * - Uses body overflow hidden for desktop
 * - Uses touchmove preventDefault for iOS (required for Safari)
 * - Preserves scroll position on lock/unlock
 * 
 * Scroll-in-scroll support:
 * - Dynamically detects scrollable containers (overflow-y: auto/scroll)
 * - Allows scrolling within ANY scrollable child (popovers, dropdowns, lists)
 * - Clamps at scroll boundaries to prevent page overscroll
 * - No per-element opt-in needed — works globally
 * 
 * Usage:
 * useScrollLock(isModalOpen);
 */
export function useScrollLock(isLocked: boolean) {
    const scrollPositionRef = useRef(0);

    useEffect(() => {
        if (!isLocked) return;

        // Save current scroll position
        scrollPositionRef.current = window.scrollY;

        // Get scrollbar width to prevent layout shift
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        // Apply lock styles to body
        const originalStyles = {
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            top: document.body.style.top,
            left: document.body.style.left,
            right: document.body.style.right,
            paddingRight: document.body.style.paddingRight,
        };

        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollPositionRef.current}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';

        // Compensate for scrollbar to prevent layout shift
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        // Track touch start Y for direction detection
        let touchStartY = 0;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartY = e.touches[0].clientY;
        };

        // iOS Safari: prevent touchmove from scrolling the page
        // but allow scrolling within any scrollable container
        const handleTouchMove = (e: TouchEvent) => {
            const target = e.target as HTMLElement;
            if (!target) return;

            // Walk up from touch target to find nearest scrollable element
            const scrollable = findScrollableAncestor(target);

            if (scrollable) {
                // Found a scrollable container — allow scroll but clamp at boundaries
                const { scrollTop, scrollHeight, clientHeight } = scrollable;
                const touchY = e.touches[0].clientY;
                const deltaY = touchStartY - touchY;
                const isScrollingDown = deltaY > 0;
                const isScrollingUp = deltaY < 0;

                const atTop = scrollTop <= 0 && isScrollingUp;
                const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && isScrollingDown;

                if (atTop || atBottom) {
                    e.preventDefault();
                }
                // Otherwise allow natural scroll within the container
            } else {
                // No scrollable container found — prevent page scroll
                e.preventDefault();
            }
        };

        // Use non-passive listeners so we can preventDefault
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            // Restore original styles
            document.body.style.overflow = originalStyles.overflow;
            document.body.style.position = originalStyles.position;
            document.body.style.top = originalStyles.top;
            document.body.style.left = originalStyles.left;
            document.body.style.right = originalStyles.right;
            document.body.style.paddingRight = originalStyles.paddingRight;

            // Restore scroll position
            window.scrollTo(0, scrollPositionRef.current);

            // Remove iOS handlers
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
        };
    }, [isLocked]);
}

/**
 * Walk up from element to find the nearest scrollable ancestor.
 * Stops at body (never returns body itself — that's what we're locking).
 * Returns null if no scrollable ancestor found.
 */
function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
        if (current.scrollHeight > current.clientHeight) {
            const overflow = getComputedStyle(current).overflowY;
            if (overflow === 'auto' || overflow === 'scroll') {
                return current;
            }
        }
        current = current.parentElement;
    }

    return null;
}

export default useScrollLock;
