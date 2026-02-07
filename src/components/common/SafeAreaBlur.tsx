import React, { useState, useEffect } from 'react';
import { useLayout } from '../../context/LayoutContext';

/**
 * SafeAreaBlur - Overlay for the top safe area (notch/camera region)
 * 
 * Shows a glassmorphism blur effect only when content scrolls behind it.
 * Tracks both main-scroll (dashboard/tabs) and settings-scroll containers.
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

        // Handle scroll containers (main-scroll and settings-scroll)
        const handleContainerScroll = (e: Event) => {
            const target = e.target as HTMLElement;

            // Track both main-scroll and settings-scroll containers
            if (target && (target.id === 'main-scroll' || target.id === 'settings-scroll')) {
                const scrolled = target.scrollTop > 10;
                setIsScrolled(scrolled);
            }
            // Ignore all other scroll events (widgets, lists, etc.)
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
        // Try main-scroll first (dashboard/tabs)
        const mainScroll = document.getElementById('main-scroll');
        if (mainScroll && mainScroll.style.display !== 'none') {
            mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // Try settings-scroll
        const settingsScroll = document.getElementById('settings-scroll');
        if (settingsScroll && settingsScroll.style.display !== 'none') {
            settingsScroll.scrollTo({ top: 0, behavior: 'smooth' });
            return;
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
