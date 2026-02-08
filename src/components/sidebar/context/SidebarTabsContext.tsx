import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
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
            const response = await fetch('/api/tabs', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                const data: TabsResponse = await response.json();
                setTabs(data.tabs || []);
            }
        } catch (error) {
            // Silent fail for tabs
        }
    }, []);

    // Fetch tab groups from per-user API
    const fetchGroups = useCallback(async (): Promise<void> => {
        try {
            const response = await fetch('/api/tab-groups', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                const sorted = (data.tabGroups || []).sort(
                    (a: TabGroup, b: TabGroup) => (a.order ?? 0) - (b.order ?? 0)
                );
                setGroups(sorted);
            }
        } catch (error) {
            // Silent fail for groups
        }
    }, []);

    // Fetch user profile
    const fetchUserProfile = useCallback(async (): Promise<void> => {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setCurrentUser({
                    username: data.user.username,
                    profilePicture: data.user.profilePicture
                });
            }
        } catch (error) {
            // Silent fail for profile
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchTabs();
        fetchGroups();
        fetchUserProfile();

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
        const handleProfilePictureUpdate = (event: Event): void => {
            const customEvent = event as CustomEvent<{ profilePicture: string }>;
            setCurrentUser(prev => prev ? { ...prev, profilePicture: customEvent.detail.profilePicture } : null);
        };
        window.addEventListener('profilePictureUpdated', handleProfilePictureUpdate as EventListener);

        return () => {
            window.removeEventListener('tabsUpdated', handleTabsUpdated);
            window.removeEventListener('tabGroupsUpdated', handleGroupsUpdated);
            window.removeEventListener('profilePictureUpdated', handleProfilePictureUpdate as EventListener);
        };
    }, [fetchTabs, fetchGroups, fetchUserProfile]);

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

export function useSidebarTabs() {
    const context = useContext(SidebarTabsContext);
    if (!context) {
        throw new Error('useSidebarTabs must be used within SidebarTabsProvider');
    }
    return context;
}

export { SidebarTabsContext };
