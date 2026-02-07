import { useEffect, useRef } from 'react';

/**
 * useScrollLock - Prevents page scrolling when modal/overlay is open
 * 
 * iOS Safari Compatible:
 * - Uses body overflow hidden for desktop
 * - Uses touchmove preventDefault for iOS (required for Safari)
 * - Preserves scroll position on lock/unlock
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

        // iOS Safari specific: prevent touchmove on document
        // This is required because overflow: hidden doesn't work on iOS
        const handleTouchMove = (e: TouchEvent) => {
            // Allow scrolling within the modal content
            const target = e.target as HTMLElement;
            const scrollableParent = target.closest('[data-scroll-lock-allow]');

            if (scrollableParent) {
                // Check if element has scrollable content
                const isAtTop = scrollableParent.scrollTop === 0;
                const isAtBottom =
                    scrollableParent.scrollTop + scrollableParent.clientHeight >=
                    scrollableParent.scrollHeight;

                // Determine scroll direction
                const touch = e.touches[0];
                const startY = (e as any)._startY ?? touch.clientY;
                const deltaY = touch.clientY - startY;

                // Allow scrolling within bounds
                if ((isAtTop && deltaY > 0) || (isAtBottom && deltaY < 0)) {
                    // At scroll boundary, prevent default
                    e.preventDefault();
                }
                // Otherwise allow the scroll within the element
                return;
            }

            // Prevent all scrolling outside designated areas
            e.preventDefault();
        };

        // Store touch start position for direction detection
        const handleTouchStart = (e: TouchEvent) => {
            (e as any)._startY = e.touches[0].clientY;
        };

        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchstart', handleTouchStart, { passive: true });

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
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchstart', handleTouchStart);
        };
    }, [isLocked]);
}

export default useScrollLock;
