import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Dashboard from './dashboard/Dashboard';
import TabContainer from './tabs/TabContainer';
import WidgetStateTestPage from './dev/WidgetStateTestPage';
import SettingsPage from './settings/SettingsPage';
import { useSharedSidebar } from '../components/sidebar/SharedSidebarContext';
import { useLayout } from '../context/LayoutContext';
import { LAYOUT } from '../constants/layout';

/**
 * PageLayer - Wrapper for keep-alive pages
 * 
 * All pages use opacity-based visibility to maintain dimensions.
 * This prevents race conditions with CSS measurements.
 */
interface PageLayerProps {
    active: boolean;
    children: ReactNode;
    /** Scroll configuration */
    scrollable?: boolean;
    /** Extra left padding (for settings sidebar) */
    paddingLeft?: number;
    /** Custom bottom offset (for mobile tab bar) */
    bottomOffset?: number;
    /** Layer ID for debugging */
    id?: string;
}

function PageLayer({
    active,
    children,
    scrollable = false,
    paddingLeft = 0,
    bottomOffset = 0,
    id,
}: PageLayerProps): React.JSX.Element {
    return (
        <div
            id={id}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: bottomOffset,
                opacity: active ? 1 : 0,
                pointerEvents: active ? 'auto' : 'none',
                overflowY: scrollable ? 'auto' : 'hidden',
                WebkitOverflowScrolling: scrollable ? 'touch' : undefined,
                display: 'flex',
                paddingLeft,
                transition: 'padding-left 0.3s ease',
            }}
        >
            {children}
        </div>
    );
}

/**
 * Parse the current page from hash
 * Returns: 'dashboard' | 'settings' | 'dev/*' | tab slug
 */
function parsePageFromHash(hash: string): string {
    if (!hash || hash === 'dashboard' || hash.startsWith('dashboard?')) {
        return 'dashboard';
    }
    if (hash === 'settings' || hash.startsWith('settings?') || hash.startsWith('settings/')) {
        return 'settings';
    }
    if (hash.startsWith('dev/')) {
        return hash; // Return full dev path
    }
    // Everything else is a tab slug
    return hash;
}

/**
 * Check if a page identifier is a tab
 */
function isTabPage(page: string): boolean {
    return page !== 'dashboard' && page !== 'settings' && !page.startsWith('dev/');
}

/**
 * MainContent - Unified page layer manager
 * 
 * Manages visibility of all main app pages using keep-alive pattern:
 * - Dashboard (always mounted)
 * - Tabs (mounted once visited, closeable)
 * - Settings (mounted once visited)
 * - Dev pages (conditional render)
 * 
 * All pages stay mounted and are shown/hidden via opacity.
 * This eliminates re-navigation animations and measurement race conditions.
 */
const MainContent = (): React.JSX.Element => {
    const location = useLocation();
    const { isExpanded } = useSharedSidebar();
    const { isMobile } = useLayout();

    // Current active page
    const [currentPage, setCurrentPage] = useState<string>(() =>
        parsePageFromHash(window.location.hash.slice(1))
    );

    // Set of pages that have been visited (and should stay mounted)
    const [visitedPages, setVisitedPages] = useState<Set<string>>(
        () => new Set(['dashboard'])
    );

    // Track hash changes and update current page
    useEffect(() => {
        const updatePage = (): void => {
            const hash = window.location.hash.slice(1);

            // Auto-redirect root with no hash to /#dashboard
            if (!hash && location.pathname === '/') {
                window.location.hash = 'dashboard';
                return;
            }

            const page = parsePageFromHash(hash);
            setCurrentPage(page);

            // Add to visited pages (except dev pages which are conditional)
            if (!page.startsWith('dev/')) {
                setVisitedPages(prev => {
                    if (prev.has(page)) return prev;
                    return new Set([...prev, page]);
                });
            }
        };

        updatePage();
        window.addEventListener('hashchange', updatePage);
        return () => window.removeEventListener('hashchange', updatePage);
    }, [location.pathname]);

    // Close a tab (remove from visited set to unmount it)
    const closeTab = useCallback((tabSlug: string) => {
        setVisitedPages(prev => {
            const next = new Set(prev);
            next.delete(tabSlug);
            return next;
        });
        // Navigate back to dashboard
        window.location.hash = 'dashboard';
    }, []);

    // Calculate extra padding for settings container when sidebar is expanded
    const settingsExtraPadding = (!isMobile && isExpanded)
        ? LAYOUT.SIDEBAR_WIDTH_EXPANDED - LAYOUT.SIDEBAR_WIDTH
        : 0;

    // Mobile tab bar offset
    const mobileTabBarOffset = isMobile ? LAYOUT.TABBAR_HEIGHT + LAYOUT.PAGE_MARGIN : 0;

    // Get visited tabs
    const visitedTabs = Array.from(visitedPages).filter(isTabPage);

    // Dev pages are rendered conditionally (not keep-alive)
    if (currentPage === 'dev/widget-states') {
        return <WidgetStateTestPage />;
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Dashboard Layer - always mounted */}
            <PageLayer
                id="dashboard-layer"
                active={currentPage === 'dashboard'}
                scrollable={true}
            >
                <Dashboard />
            </PageLayer>

            {/* Tab Layers - mounted once visited, closeable */}
            {visitedTabs.map(tabSlug => (
                <PageLayer
                    key={tabSlug}
                    id={`tab-layer-${tabSlug}`}
                    active={currentPage === tabSlug}
                    scrollable={false}
                    bottomOffset={mobileTabBarOffset}
                >
                    <TabContainer
                        singleTabSlug={tabSlug}
                        onCloseTab={() => closeTab(tabSlug)}
                    />
                </PageLayer>
            ))}

            {/* Settings Layer - mounted once visited */}
            {visitedPages.has('settings') && (
                <PageLayer
                    id="settings-layer"
                    active={currentPage === 'settings'}
                    scrollable={true}
                    paddingLeft={settingsExtraPadding}
                >
                    <SettingsPage />
                </PageLayer>
            )}
        </div>
    );
};

export default MainContent;
