import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { Menu, ChevronLeft } from 'lucide-react';
import { useLayout } from '../../context/LayoutContext';
import { useSettingsNav } from '../../context/SettingsNavContext';
import './SettingsLayout.css';

/**
 * SettingsLayout - Responsive wrapper for iOS-style settings
 * 
 * Handles three layout modes:
 * - Wide Desktop (≥1024px): Sidebar always visible + content side-by-side
 * - Narrow Desktop (768-1023px): Collapsed sidebar with toggle, overlay when open
 * - Mobile (<768px): Full-screen navigation stack with slide animations
 */

interface SettingsLayoutProps {
    /** Sidebar content (SettingsSidebar component) */
    sidebar: ReactNode;
    /** Main content area */
    children: ReactNode;
    /** Current page title (for header) */
    title?: string;
    /** Whether sidebar is visible (only for narrow desktop) */
    sidebarOpen?: boolean;
    /** Callback to toggle sidebar (only for narrow desktop) */
    onToggleSidebar?: () => void;
}

// Breakpoint for narrow desktop (between mobile and wide desktop)
const NARROW_DESKTOP_MAX = 1023;

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
    sidebar,
    children,
    title,
    sidebarOpen: controlledSidebarOpen,
    onToggleSidebar
}) => {
    const { isMobile } = useLayout();
    const { canGoBack, goBack, getBreadcrumbs, depth } = useSettingsNav();

    // Track window width for narrow desktop detection
    const [windowWidth, setWindowWidth] = useState<number>(
        typeof window !== 'undefined' ? window.innerWidth : 1024
    );

    // Internal sidebar state (for uncontrolled mode)
    const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);

    // Use controlled or internal state
    const sidebarOpen = controlledSidebarOpen ?? internalSidebarOpen;
    const toggleSidebar = onToggleSidebar ?? (() => setInternalSidebarOpen(prev => !prev));

    // Determine layout mode
    const isNarrowDesktop = !isMobile && windowWidth <= NARROW_DESKTOP_MAX;
    const isWideDesktop = !isMobile && windowWidth > NARROW_DESKTOP_MAX;

    // Track window resize
    useEffect(() => {
        const handleResize = (): void => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close sidebar when clicking overlay
    const handleOverlayClick = useCallback((): void => {
        if (sidebarOpen) {
            toggleSidebar();
        }
    }, [sidebarOpen, toggleSidebar]);

    // Close sidebar on navigation (for narrow desktop)
    useEffect(() => {
        if (isNarrowDesktop && sidebarOpen) {
            setInternalSidebarOpen(false);
        }
    }, [depth]); // Close when navigation depth changes

    // Get breadcrumbs for header
    const breadcrumbs = getBreadcrumbs();
    const displayTitle = title || breadcrumbs[breadcrumbs.length - 1] || 'Settings';
    const parentTitle = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : undefined;

    // Mobile: Full-screen navigation (children handle their own layout)
    if (isMobile) {
        return (
            <div className="settings-layout">
                {/* Mobile header with back button */}
                {depth > 0 && (
                    <div className="settings-header">
                        <button
                            className="settings-header__back"
                            onClick={goBack}
                            aria-label="Go back"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="settings-header__title">
                            {parentTitle && (
                                <span className="settings-header__breadcrumb">{parentTitle} › </span>
                            )}
                            {displayTitle}
                        </div>
                    </div>
                )}
                <div className="settings-content">
                    {children}
                </div>
            </div>
        );
    }

    // Narrow Desktop: Collapsible sidebar with overlay
    if (isNarrowDesktop) {
        return (
            <div className="settings-layout">
                {/* Overlay backdrop */}
                <div
                    className={`settings-sidebar-overlay ${sidebarOpen ? 'settings-sidebar-overlay--visible' : ''}`}
                    onClick={handleOverlayClick}
                    aria-hidden="true"
                />

                {/* Sidebar (overlay mode) */}
                <div className={`settings-sidebar settings-sidebar--overlay ${sidebarOpen ? 'settings-sidebar--open' : ''}`}>
                    {sidebar}
                </div>

                {/* Header with menu button */}
                <div className="settings-header">
                    <button
                        className="settings-header__menu"
                        onClick={toggleSidebar}
                        aria-label="Toggle menu"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="settings-header__title">{displayTitle}</div>
                </div>

                {/* Content area */}
                <div className="settings-content">
                    {children}
                </div>
            </div>
        );
    }

    // Wide Desktop: Split view with persistent sidebar
    return (
        <div className="settings-layout settings-layout--desktop">
            {/* Sidebar (always visible) */}
            <div className="settings-sidebar">
                {sidebar}
            </div>

            {/* Content area */}
            <div className="settings-content">
                {children}
            </div>
        </div>
    );
};

export default SettingsLayout;
