import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { useLayout } from '../../../context/LayoutContext';
import { useDashboardEdit } from '../../../context/DashboardEditContext';
import { triggerHaptic } from '../../../utils/haptics';
import { Tab } from '../types';

// ============================================================================
// SidebarNavigationContext
// Manages: Routing, nav item tracking, settings mode, and navigation handlers
// ============================================================================

export type SidebarMode = 'tabs' | 'settings' | 'notifications';

interface SidebarNavigationContextType {
    // Sidebar mode state
    sidebarMode: SidebarMode;
    setSidebarMode: React.Dispatch<React.SetStateAction<SidebarMode>>;
    settingsNavPath: string[];
    setSettingsNavPath: React.Dispatch<React.SetStateAction<string[]>>;
    shouldAutoExpand: boolean;
    expandedSettingsCategory: string | null;
    setExpandedSettingsCategory: React.Dispatch<React.SetStateAction<string | null>>;
    lastSettingsPath: string | null;

    // Navigation functions
    handleNavigation: (e: React.MouseEvent<HTMLAnchorElement>, destination: string) => void;
    handleLogout: () => void;
    handleOpenNotificationCenter: (setShowNotificationCenter: React.Dispatch<React.SetStateAction<boolean>>, isExpanded: boolean, setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>) => void;
    getActiveNavItem: () => string;

    // Route info
    location: ReturnType<typeof useLocation>;

    // Dashboard edit context pass-through
    dashboardEdit: ReturnType<typeof useDashboardEdit>;
}

const SidebarNavigationContext = createContext<SidebarNavigationContextType | null>(null);

interface SidebarNavigationProviderProps {
    children: ReactNode;
    tabs: Tab[];
    onExpandSidebar?: () => void;
}

export function SidebarNavigationProvider({ children, tabs, onExpandSidebar }: SidebarNavigationProviderProps) {
    // Sidebar mode state
    const [sidebarMode, setSidebarMode] = useState<SidebarMode>('tabs');
    const [settingsNavPath, setSettingsNavPath] = useState<string[]>([]);
    const [expandedSettingsCategory, setExpandedSettingsCategory] = useState<string | null>(null);

    /**
     * @deprecated No longer needed with keep-alive architecture.
     * Settings page stays mounted, so we don't need to remember and re-navigate.
     * This will be removed after testing confirms the new architecture works.
     */
    const [lastSettingsPath, setLastSettingsPath] = useState<string | null>(null);

    // Track initial render to skip storing lastSettingsPath
    const isInitialRender = useRef(true);

    // Context hooks
    const { isWideDesktop } = useLayout();
    const { logout, user } = useAuth();
    const { info } = useNotifications();
    const dashboardEdit = useDashboardEdit();
    const navigate = useNavigate();
    const location = useLocation();

    // Derived: should sidebar auto-expand (settings mode on wide desktop)
    const shouldAutoExpand = sidebarMode === 'settings' && isWideDesktop;

    // Get active nav item based on current route
    const getActiveNavItem = useCallback((): string => {
        const hash = window.location.hash.slice(1);
        if (!hash || hash === 'dashboard') return 'dashboard';
        if (hash.startsWith('settings')) {
            const [pathPart, queryPart] = hash.split('?');
            const searchParams = new URLSearchParams(queryPart || '');

            // Path-based profile detection
            if (pathPart === 'settings/profile' && searchParams.get('source') === 'profile') {
                return 'profile';
            }
            // Query-based profile detection (legacy)
            if (searchParams.get('tab') === 'profile' && searchParams.get('source') === 'profile') {
                return 'profile';
            }

            const pathSegments = pathPart.split('/').filter(Boolean);
            const categoryId = pathSegments[1];
            const subTabId = pathSegments[2];

            if (categoryId && subTabId) {
                return `settings-${categoryId}-${subTabId}`;
            }
            if (categoryId) {
                return `settings-${categoryId}`;
            }

            return 'settings';
        }
        // Check for tabs
        const matchingTab = tabs.find(tab => hash === tab.slug);
        if (matchingTab) return `tab-${matchingTab.id}`;
        return 'dashboard';
    }, [tabs]);

    // Navigation guard - intercepts navigation when in edit mode
    const handleNavigation = useCallback((e: React.MouseEvent<HTMLAnchorElement>, destination: string): void => {
        if (!dashboardEdit?.editMode) {
            return; // Let the <a> href do its job
        }

        if (!dashboardEdit.hasUnsavedChanges) {
            dashboardEdit.handlers?.handleCancel();
            return;
        }

        e.preventDefault();
        dashboardEdit.setPendingDestination(destination);
    }, [dashboardEdit]);

    // Logout handler
    const handleLogout = useCallback((): void => {
        triggerHaptic();

        const displayName = user?.displayName || user?.username || 'User';
        info('Goodbye!', `See you soon, ${displayName}`);

        setTimeout(() => {
            window.location.href = '/api/auth/logout';
        }, 1000);
    }, [user, info]);

    // Open notification center (takes UI state setters as params to avoid circular dep)
    const handleOpenNotificationCenter = useCallback((
        setShowNotificationCenter: React.Dispatch<React.SetStateAction<boolean>>,
        isExpanded: boolean,
        setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>
    ): void => {
        setShowNotificationCenter(true);
        if (!isExpanded) {
            setIsExpanded(true);
        }
    }, []);

    // URL sync effect - detect settings URLs and update sidebar mode
    // ONLY on initial navigation to settings (not when user toggles mode manually)
    const prevHashRef = useRef<string>('');
    useEffect(() => {
        const hash = window.location.hash.slice(1);
        const prevHash = prevHashRef.current;
        prevHashRef.current = hash;

        // Only auto-switch to settings mode when NAVIGATING TO a settings page
        // (not when already on settings and user toggles to tabs view)
        const wasOnSettings = prevHash.startsWith('settings');
        const isOnSettings = hash.startsWith('settings');

        if (isOnSettings) {
            const [pathPart] = hash.split('?');
            const pathSegments = pathPart.replace('settings', '').replace(/^\//, '').split('/').filter(Boolean);

            // Only auto-set mode if we just navigated TO settings (not already on it)
            if (!wasOnSettings) {
                setSidebarMode('settings');
            }
            setSettingsNavPath(pathSegments);

            // Store the full settings path in memory (for return navigation)
            const isProfilePage = pathPart === 'settings/profile' || pathPart.startsWith('settings/profile?');
            if (!isInitialRender.current && !isProfilePage) {
                setLastSettingsPath('#' + hash);
            }
            isInitialRender.current = false;

            // Auto-expand accordion for the active category
            const categoryId = pathSegments[0];
            if (categoryId && categoryId !== expandedSettingsCategory) {
                setExpandedSettingsCategory(categoryId);
            }

            // Auto-expand sidebar on wide screens when entering settings
            if (isWideDesktop && onExpandSidebar && !wasOnSettings) {
                onExpandSidebar();
            }
        } else if (wasOnSettings) {
            // With keep-alive architecture, DON'T reset settings state when leaving
            // User should return to Settings exactly as they left it
            setSidebarMode('tabs');
            // Keep settingsNavPath and expandedSettingsCategory preserved
            // setSettingsNavPath([]);  // REMOVED - keep path
            // setExpandedSettingsCategory(null);  // REMOVED - keep accordion state
        }
    }, [location.hash, isWideDesktop, onExpandSidebar, expandedSettingsCategory]);

    // Memoize context value
    const value = useMemo<SidebarNavigationContextType>(() => ({
        sidebarMode,
        setSidebarMode,
        settingsNavPath,
        setSettingsNavPath,
        shouldAutoExpand,
        expandedSettingsCategory,
        setExpandedSettingsCategory,
        lastSettingsPath,
        handleNavigation,
        handleLogout,
        handleOpenNotificationCenter,
        getActiveNavItem,
        location,
        dashboardEdit,
    }), [
        sidebarMode, settingsNavPath, shouldAutoExpand, expandedSettingsCategory,
        lastSettingsPath, handleNavigation, handleLogout, handleOpenNotificationCenter,
        getActiveNavItem, location, dashboardEdit
    ]);

    return (
        <SidebarNavigationContext.Provider value={value}>
            {children}
        </SidebarNavigationContext.Provider>
    );
}

export function useSidebarNavigation() {
    const context = useContext(SidebarNavigationContext);
    if (!context) {
        throw new Error('useSidebarNavigation must be used within SidebarNavigationProvider');
    }
    return context;
}

export { SidebarNavigationContext };
