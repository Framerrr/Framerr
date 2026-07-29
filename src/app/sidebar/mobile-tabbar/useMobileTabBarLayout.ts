import { useCallback, useMemo } from 'react';
import { useUserConfigQuery, useUpdateUserConfig } from '@/api/hooks/useConfig';
import { useSidebarTabs } from '@/app/sidebar/context/useSidebarTabs';
import { useActiveDashboard } from '@/context/ActiveDashboardContext';
import {
    createDefaultTabBarPrefs,
    resolveTabBarLayout,
    sanitizeTabBarPrefs,
    type MobileTabBarPrefs,
    type TabBarSlot,
} from './tabBarLayout';
import { TAB_BAR_KNOWN_IDS } from './tabBarActionRegistry';
import { computeTabBarLayoutReady } from './tabBarReadiness';

export function useMobileTabBarLayout(): {
    slots: TabBarSlot[];
    prefs: MobileTabBarPrefs;
    savePrefs: (next: MobileTabBarPrefs) => Promise<void>;
    isLoading: boolean;
    layoutReady: boolean;
} {
    const { data: config, isLoading } = useUserConfigQuery();
    const updateConfig = useUpdateUserConfig();
    const { homeDashboardId } = useActiveDashboard();
    const { tabs: sidebarTabs, tabsLoaded } = useSidebarTabs();

    const knownTabIds = useMemo((): ReadonlySet<string> | undefined => {
        if (!tabsLoaded) return undefined;
        const enabled = sidebarTabs.filter(t => t.enabled !== false);
        return new Set(enabled.map(t => t.id));
    }, [sidebarTabs, tabsLoaded]);

    const prefs = useMemo(
        () =>
            sanitizeTabBarPrefs(
                config?.preferences?.mobileTabBar,
                TAB_BAR_KNOWN_IDS,
                homeDashboardId,
                knownTabIds,
            ),
        [config?.preferences?.mobileTabBar, homeDashboardId, knownTabIds],
    );

    const slots = useMemo(
        () =>
            resolveTabBarLayout(
                isLoading ? createDefaultTabBarPrefs(homeDashboardId) : prefs,
                TAB_BAR_KNOWN_IDS,
                homeDashboardId,
                knownTabIds,
            ),
        [isLoading, prefs, homeDashboardId, knownTabIds],
    );

    const hasIframeTabSlot = useMemo(
        () => prefs.slots.some(s => s.kind === 'iframeTab'),
        [prefs.slots],
    );

    const layoutReady = computeTabBarLayoutReady({
        configLoading: isLoading,
        hasIframeTabSlot,
        tabsLoaded,
    });

    const savePrefs = useCallback(
        async (next: MobileTabBarPrefs): Promise<void> => {
            const complete = sanitizeTabBarPrefs(
                next,
                TAB_BAR_KNOWN_IDS,
                homeDashboardId,
                knownTabIds,
            );
            await updateConfig.mutateAsync({
                preferences: { mobileTabBar: complete },
            });
        },
        [updateConfig, homeDashboardId, knownTabIds],
    );

    return { slots, prefs, savePrefs, isLoading, layoutReady };
}
