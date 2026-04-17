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

        // Collect all scroll containers: dashboard, settings, and tab layers
        const containers: HTMLElement[] = [];

        const dashboard = document.getElementById('dashboard-layer');
        const settings = document.getElementById('settings-layer');
        if (dashboard) containers.push(dashboard);
        if (settings) containers.push(settings);

        // Tab layers use id="tab-layer-{slug}"
        document.querySelectorAll<HTMLElement>('[id^="tab-layer-"]').forEach(el => {
            containers.push(el);
        });

        containers.forEach(el => el.addEventListener('scroll', handleScroll, { passive: true }));

        return () => {
            containers.forEach(el => el.removeEventListener('scroll', handleScroll));
        };
    }, [isOpen, handleScroll]);
}

export default useCloseOnScroll;
