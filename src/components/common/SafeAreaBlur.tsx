import React, { useState, useEffect } from 'react';
import { useLayout } from '../../context/LayoutContext';

/**
 * SafeAreaBlur - Overlay for the top safe area (notch/camera region)
 * 
 * Shows a glassmorphism blur effect only when content scrolls behind it.
 * Tracks dashboard-layer, settings-layer, and tab-layer scroll containers.
 */
const SafeAreaBlur: React.FC = () => {
    const { isMobile } = useLayout();
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        if (!isMobile) return;

        // Handle window scroll
        const handleWindowScroll = () => {
            const scrolled = window.scrollY > 10;
            setIsScrolled(scrolled);
        };

        // Handle scroll containers (dashboard-layer, settings-layer, tab-layer-*)
        const handleContainerScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            if (!target?.id) return;

            // Only track page-level scroll containers
            const isPageContainer = target.id === 'dashboard-layer'
                || target.id === 'settings-layer'
                || target.id.startsWith('tab-layer-');

            if (isPageContainer) {
                const scrolled = target.scrollTop > 10;
                setIsScrolled(scrolled);
            }
        };

        // Listen to window scroll
        window.addEventListener('scroll', handleWindowScroll, { passive: true });

        // Also listen to document scroll with capture to catch container events
        document.addEventListener('scroll', handleContainerScroll, { capture: true, passive: true });

        // Initial check
        handleWindowScroll();

        return () => {
            window.removeEventListener('scroll', handleWindowScroll);
            document.removeEventListener('scroll', handleContainerScroll, { capture: true });
        };
    }, [isMobile]);

    if (!isMobile) return null;

    // Scroll to top when safe area is tapped - scroll the visible container
    const handleTap = () => {
        // Find the currently visible page layer and scroll it to top
        const layers = ['dashboard-layer', 'settings-layer'];
        for (const id of layers) {
            const el = document.getElementById(id);
            if (el && el.style.visibility !== 'hidden') {
                el.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }

        // Check tab layers
        const tabLayers = document.querySelectorAll<HTMLElement>('[id^="tab-layer-"]');
        for (const el of tabLayers) {
            if (el.style.visibility !== 'hidden') {
                el.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }

        // Fallback to window scroll
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div
            className={`fixed top-0 left-0 right-0 z-50 ${isScrolled ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
            onClick={isScrolled ? handleTap : undefined}
            style={{
                height: 'env(safe-area-inset-top, 0px)',
                backgroundColor: isScrolled ? 'var(--glass-bg, rgba(10, 14, 26, 0.7))' : 'transparent',
                backdropFilter: isScrolled ? 'blur(var(--blur-strong, 20px))' : 'none',
                WebkitBackdropFilter: isScrolled ? 'blur(var(--blur-strong, 20px))' : 'none',
                transition: 'background-color 0.15s ease, backdrop-filter 0.15s ease',
                borderBottom: isScrolled ? '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))' : 'none',
            }}
        />
    );
};

export default SafeAreaBlur;
