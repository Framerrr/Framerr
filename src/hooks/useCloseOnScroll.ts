import { useEffect, useCallback } from 'react';

/**
 * useCloseOnScroll - Closes a popover when the main scroll containers scroll
 * 
 * Usage:
 * const [isOpen, setIsOpen] = useState(false);
 * useCloseOnScroll(isOpen, () => setIsOpen(false));
 */
export function useCloseOnScroll(isOpen: boolean, onClose: () => void) {
    // Memoize onClose to avoid effect re-running
    const handleScroll = useCallback(() => {
        // Blur the active element before closing to prevent browser from
        // scrolling to the trigger when Radix restores focus
        (document.activeElement as HTMLElement)?.blur();
        onClose();
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;

        const mainScroll = document.getElementById('main-scroll');
        const settingsScroll = document.getElementById('settings-scroll');

        mainScroll?.addEventListener('scroll', handleScroll, { passive: true });
        settingsScroll?.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            mainScroll?.removeEventListener('scroll', handleScroll);
            settingsScroll?.removeEventListener('scroll', handleScroll);
        };
    }, [isOpen, handleScroll]);
}

export default useCloseOnScroll;
