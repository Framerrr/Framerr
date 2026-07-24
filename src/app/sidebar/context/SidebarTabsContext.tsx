import React, { createContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { tabsApi, tabGroupsApi, authApi } from '../../../api/endpoints';
import { Tab, UserProfile, TabsResponse } from '../types';

// ============================================================================
// SidebarTabsContext
// Manages: Tab data fetching, tab groups, and user profile for sidebar display
// ============================================================================

interface TabGroup {
    id: string;
    name: string;
    icon?: string | null;
    order?: number;
}

interface SidebarTabsContextType {
    tabs: Tab[];
    groups: TabGroup[];
    currentUser: UserProfile | null;
    refreshTabs: () => void;
    refreshGroups: () => void;
}

const SidebarTabsContext = createContext<SidebarTabsContextType | null>(null);

interface SidebarTabsProviderProps {
    children: ReactNode;
}

export function SidebarTabsProvider({ children }: SidebarTabsProviderProps) {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [groups, setGroups] = useState<TabGroup[]>([]);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

    // Fetch tabs from API
    const fetchTabs = useCallback(async (): Promise<void> => {
        try {
            const data = await tabsApi.getAll() as TabsResponse;
            setTabs(data.tabs || []);
        } catch {
            // Silent fail for tabs
        }
    }, []);

    // Fetch tab groups from per-user API
    const fetchGroups = useCallback(async (): Promise<void> => {
        try {
            const data = await tabGroupsApi.getAll() as { tabGroups?: TabGroup[] };
            const sorted = (data.tabGroups || []).sort(
                (a: TabGroup, b: TabGroup) => (a.order ?? 0) - (b.order ?? 0)
            );
            setGroups(sorted);
        } catch {
            // Silent fail for groups
        }
    }, []);

    // Fetch user profile
    const fetchUserProfile = useCallback(async (): Promise<void> => {
        try {
            const data = await authApi.getSession() as { user: { username: string; profilePicture?: string } };
            setCurrentUser({
                username: data.user.username,
                profilePicture: data.user.profilePicture
                    ? `${data.user.profilePicture}?t=${Date.now()}`
                    : undefined
            });
        } catch {
            // Silent fail for profile
        }
    }, []);

    // Profile picture update handler — defined outside effect to satisfy lint
    const handleProfilePictureUpdate = useCallback((event: Event): void => {
        const customEvent = event as CustomEvent<{ profilePicture: string }>;
        setCurrentUser(prev => prev ? { ...prev, profilePicture: customEvent.detail.profilePicture } : null);
    }, []);

    // Initial fetch
    useEffect(() => {
        queueMicrotask(() => {
            fetchTabs();
            fetchGroups();
            fetchUserProfile();
        });

        // Listen for tabs updates
        const handleTabsUpdated = (): void => {
            fetchTabs();
        };
        window.addEventListener('tabsUpdated', handleTabsUpdated);

        // Listen for tab groups updates
        const handleGroupsUpdated = (): void => {
            fetchGroups();
        };
        window.addEventListener('tabGroupsUpdated', handleGroupsUpdated);

        // Listen for profile picture updates from settings
        window.addEventListener('profilePictureUpdated', handleProfilePictureUpdate as EventListener);

        return () => {
            window.removeEventListener('tabsUpdated', handleTabsUpdated);
            window.removeEventListener('tabGroupsUpdated', handleGroupsUpdated);
            window.removeEventListener('profilePictureUpdated', handleProfilePictureUpdate as EventListener);
        };
    }, [fetchTabs, fetchGroups, fetchUserProfile, handleProfilePictureUpdate]);

    // Memoize context value
    const value = useMemo<SidebarTabsContextType>(() => ({
        tabs,
        groups,
        currentUser,
        refreshTabs: fetchTabs,
        refreshGroups: fetchGroups,
    }), [tabs, groups, currentUser, fetchTabs, fetchGroups]);

    return (
        <SidebarTabsContext.Provider value={value}>
            {children}
        </SidebarTabsContext.Provider>
    );
}

export { SidebarTabsContext };
