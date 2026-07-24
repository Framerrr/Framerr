import React, { useMemo, useCallback } from 'react';
import { useAppBranding } from '../../providers/useAppBranding';
import { useNotifications } from '../../../context/notification';
import { renderIcon } from '../../../utils/iconUtils';
import { useSidebarUI } from './useSidebarUI';
import { useSidebarTabs } from './useSidebarTabs';
import { useSidebarNavigation } from './useSidebarNavigation';

/**
 * Backwards-compatible hook that provides the full SharedSidebarContext interface.
 */
export function useSharedSidebar() {
    const ui = useSidebarUI();
    const tabsCtx = useSidebarTabs();
    const nav = useSidebarNavigation();
    const { serverName, serverIcon } = useAppBranding();
    const { unreadCount } = useNotifications();

    const groups = tabsCtx.groups;

    const renderIconCallback = useCallback((iconValue: string | undefined, size: number = 20): React.ReactNode => {
        return renderIcon(iconValue, size);
    }, []);

    const handleOpenNotificationCenter = useCallback((): void => {
        nav.handleOpenNotificationCenter(
            ui.setShowNotificationCenter,
            ui.isExpanded,
            ui.setIsExpanded
        );
    }, [nav, ui.setShowNotificationCenter, ui.isExpanded, ui.setIsExpanded]);

    return useMemo(() => ({
        isExpanded: ui.isExpanded,
        setIsExpanded: ui.setIsExpanded,
        isSidebarHidden: ui.isSidebarHidden,
        setSidebarHidden: ui.setSidebarHidden,
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
        tabs: tabsCtx.tabs,
        currentUser: tabsCtx.currentUser,
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
        serverName,
        serverIcon,
        groups,
        unreadCount,
        renderIcon: renderIconCallback,
    }), [ui, tabsCtx, nav, serverName, serverIcon, groups, unreadCount, renderIconCallback, handleOpenNotificationCenter]);
}
