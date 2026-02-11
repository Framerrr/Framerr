import { useEffect, useRef } from 'react';

/**
 * useOverlayScrollLock - Prevents touch/wheel scroll from bleeding through overlays
 * 
 * When an overlay (popover, dropdown, select) is open, swiping on iOS or scrolling
 * with the mouse wheel inside the overlay can cause the page behind it to scroll.
 * This hook prevents that by:
 * 
 * 1. Intercepting touchmove/wheel events on the document
 * 2. If the event originates inside the overlay content: allows it (so internal scroll works)
 * 3. If the event originates outside overlay content but on the overlay backdrop: prevents default
 * 
 * For internal scroll, it also prevents overscroll bounce at the boundaries (top/bottom)
 * so the page doesn't scroll when the user scrolls past the end of the overlay content.
 * 
 * When the content is NOT scrollable (e.g. a short dropdown), ALL scroll events are
 * prevented so the page behind doesn't move at all.
 * 
 * Usage:
 *   const contentRef = useRef<HTMLDivElement>(null);
 *   useOverlayScrollLock(isOpen, contentRef);
 * 
 * Then attach the ref to your scrollable content container:
 *   <div ref={contentRef} className="overflow-y-auto">...</div>
 */
export function useOverlayScrollLock(
    isActive: boolean,
    contentRef: React.RefObject<HTMLElement | null>
) {
    // Track touch start position for direction detection
    const touchStartY = useRef(0);

    useEffect(() => {
        if (!isActive) return;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartY.current = e.touches[0].clientY;
        };

        const handleTouchMove = (e: TouchEvent) => {
            const content = contentRef.current;
            if (!content) return;

            const target = e.target as HTMLElement;

            // If touch is inside the overlay content
            if (content.contains(target)) {
                // Find the nearest scrollable ancestor within the content
                const scrollable = findScrollableParent(target, content);

                if (scrollable) {
                    const { scrollTop, scrollHeight, clientHeight } = scrollable;
                    const touchY = e.touches[0].clientY;
                    const deltaY = touchStartY.current - touchY;
                    const isScrollingDown = deltaY > 0;
                    const isScrollingUp = deltaY < 0;

                    // At top boundary scrolling up, or bottom boundary scrolling down
                    // Prevent to avoid page overscroll
                    const atTop = scrollTop <= 0 && isScrollingUp;
                    const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && isScrollingDown;

                    if (atTop || atBottom) {
                        e.preventDefault();
                    }
                    // Otherwise allow natural scroll within the content
                } else {
                    // Content is not scrollable — prevent page scroll
                    e.preventDefault();
                }
            }
            // Touches outside the content container are not our concern
            // (Radix handles backdrop clicks separately)
        };

        const handleWheel = (e: WheelEvent) => {
            const content = contentRef.current;
            if (!content) return;

            const target = e.target as HTMLElement;

            // Only intercept wheel events inside the overlay content
            if (content.contains(target)) {
                const scrollable = findScrollableParent(target, content);

                if (scrollable) {
                    const { scrollTop, scrollHeight, clientHeight } = scrollable;
                    const isScrollingDown = e.deltaY > 0;
                    const isScrollingUp = e.deltaY < 0;

                    const atTop = scrollTop <= 0 && isScrollingUp;
                    const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && isScrollingDown;

                    if (atTop || atBottom) {
                        e.preventDefault();
                    }
                } else {
                    // Content is not scrollable — prevent page scroll
                    e.preventDefault();
                }
            }
        };

        // Use non-passive listeners so we can preventDefault
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('wheel', handleWheel);
        };
    }, [isActive, contentRef]);
}

/**
 * Walk up from target to find the nearest scrollable ancestor within bounds.
 * Returns null if no scrollable ancestor is found within the container.
 */
function findScrollableParent(
    element: HTMLElement,
    container: HTMLElement
): HTMLElement | null {
    let current: HTMLElement | null = element;

    while (current && current !== container.parentElement) {
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

export default useOverlayScrollLock;
