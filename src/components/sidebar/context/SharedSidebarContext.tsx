import React, { useMemo, ReactNode, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppData } from '../../../context/AppDataContext';
import { useNotifications } from '../../../context/NotificationContext';
import { renderIcon } from '../../../utils/iconUtils';
import { Group } from '../types';

// Sub-contexts
import { SidebarUIProvider, useSidebarUI } from './SidebarUIContext';
import { SidebarTabsProvider, useSidebarTabs } from './SidebarTabsContext';
import { SidebarNavigationProvider, useSidebarNavigation, SidebarMode } from './SidebarNavigationContext';

// ============================================================================
// SharedSidebarContext - Thin Composition Wrapper
// Composes sub-contexts and provides backwards-compatible useSharedSidebar hook
// ============================================================================

// Re-export type for external use
export type { SidebarMode };

interface SharedSidebarProviderProps {
    children: ReactNode;
}

/**
 * Composed provider that wraps all sidebar sub-contexts.
 * Consumers can use useSharedSidebar() for the full interface (BWC),
 * or use individual hooks for focused access.
 */
export function SharedSidebarProvider({ children }: SharedSidebarProviderProps) {
    const { groups: rawGroups } = useAppData();
    const groups = rawGroups as unknown as Group[] | null;

    return (
        <SidebarTabsProvider>
            <SidebarUIProvider groups={groups}>
                <SidebarNavigationBridge groups={groups}>
                    {children}
                </SidebarNavigationBridge>
            </SidebarUIProvider>
        </SidebarTabsProvider>
    );
}

/**
 * Bridge component that connects SidebarUIContext to SidebarNavigationProvider
 * (needed because SidebarNavigationProvider needs tabs and UI state)
 */
function SidebarNavigationBridge({ children, groups }: { children: ReactNode; groups: Group[] | null }) {
    const { tabs } = useSidebarTabs();
    const { isExpanded, setIsExpanded } = useSidebarUI();

    const handleExpandSidebar = useCallback(() => {
        if (!isExpanded) {
            setIsExpanded(true);
        }
    }, [isExpanded, setIsExpanded]);

    return (
        <SidebarNavigationProvider tabs={tabs} onExpandSidebar={handleExpandSidebar}>
            {children}
        </SidebarNavigationProvider>
    );
}

/**
 * Backwards-compatible hook that provides the full SharedSidebarContext interface.
 * New code can use focused hooks (useSidebarUI, useSidebarTabs, useSidebarNavigation).
 */
export function useSharedSidebar() {
    const ui = useSidebarUI();
    const tabsCtx = useSidebarTabs();
    const nav = useSidebarNavigation();
    const { userSettings, groups: rawGroups } = useAppData();
    const { unreadCount } = useNotifications();

    const groups = rawGroups as unknown as Group[] | null;

    // Render icon helper
    const renderIconCallback = useCallback((iconValue: string | undefined, size: number = 20): React.ReactNode => {
        return renderIcon(iconValue, size);
    }, []);

    // Wrap handleOpenNotificationCenter to use UI context values
    const handleOpenNotificationCenter = useCallback((): void => {
        nav.handleOpenNotificationCenter(
            ui.setShowNotificationCenter,
            ui.isExpanded,
            ui.setIsExpanded
        );
    }, [nav, ui.setShowNotificationCenter, ui.isExpanded, ui.setIsExpanded]);

    // Memoize composed value for stability
    return useMemo(() => ({
        // From SidebarUIContext
        isExpanded: ui.isExpanded,
        setIsExpanded: ui.setIsExpanded,
        isMobileMenuOpen: ui.isMobileMenuOpen,
        setIsMobileMenuOpen: ui.setIsMobileMenuOpen,
        isMobile: ui.isMobile,
        expandedGroups: ui.expandedGroups,
        setExpandedGroups: ui.setExpandedGroups,
        hoveredItem: ui.hoveredItem,
        setHoveredItem: ui.setHoveredItem,
        showNotificationCenter: ui.showNotificationCenter,
        setShowNotificationCenter: ui.setShowNotificationCenter,
        hoverTimeoutRef: ui.hoverTimeoutRef,
        handleMouseEnter: ui.handleMouseEnter,
        handleMouseLeave: ui.handleMouseLeave,
        toggleGroup: ui.toggleGroup,

        // From SidebarTabsContext
        tabs: tabsCtx.tabs,
        currentUser: tabsCtx.currentUser,

        // From SidebarNavigationContext
        sidebarMode: nav.sidebarMode,
        setSidebarMode: nav.setSidebarMode,
        settingsNavPath: nav.settingsNavPath,
        setSettingsNavPath: nav.setSettingsNavPath,
        shouldAutoExpand: nav.shouldAutoExpand,
        expandedSettingsCategory: nav.expandedSettingsCategory,
        setExpandedSettingsCategory: nav.setExpandedSettingsCategory,
        lastSettingsPath: nav.lastSettingsPath,
        handleNavigation: nav.handleNavigation,
        handleLogout: nav.handleLogout,
        handleOpenNotificationCenter,
        getActiveNavItem: nav.getActiveNavItem,
        location: nav.location,
        dashboardEdit: nav.dashboardEdit,

        // From AppDataContext (pass-through)
        userSettings,
        groups,

        // From NotificationContext (pass-through)
        unreadCount,

        // Utility
        renderIcon: renderIconCallback,
    }), [ui, tabsCtx, nav, userSettings, groups, unreadCount, renderIconCallback, handleOpenNotificationCenter]);
}

// Dummy context for type compatibility (not actually used as we compose sub-contexts)
import { createContext } from 'react';
const SharedSidebarContext = createContext<ReturnType<typeof useSharedSidebar> | null>(null);
export { SharedSidebarContext };
