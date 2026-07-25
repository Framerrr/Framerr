import { useCallback, useMemo } from 'react';
import { useUserConfigQuery, useUpdateUserConfig } from '@/api/hooks/useConfig';
import { useTabsList } from '@/api/hooks/useSettings';
import { useActiveDashboard } from '@/context/ActiveDashboardContext';
import {
    createDefaultTabBarPrefs,
    resolveTabBarLayout,
    sanitizeTabBarPrefs,
    type MobileTabBarPrefs,
    type TabBarSlot,
} from './tabBarLayout';
import { TAB_BAR_KNOWN_IDS } from './tabBarActionRegistry';

export function useMobileTabBarLayout(): {
    slots: TabBarSlot[];
    prefs: MobileTabBarPrefs;
    savePrefs: (next: MobileTabBarPrefs) => Promise<void>;
    isLoading: boolean;
} {
    const { data: config, isLoading } = useUserConfigQuery();
    const updateConfig = useUpdateUserConfig();
    const { homeDashboardId } = useActiveDashboard();
    const { data: tabsData, isLoading: tabsLoading } = useTabsList();

    const knownTabIds = useMemo((): ReadonlySet<string> | undefined => {
        if (tabsLoading || !tabsData?.tabs) return undefined;
        const enabled = tabsData.tabs.filter(t => t.enabled !== false);
        return new Set(enabled.map(t => t.id));
    }, [tabsData?.tabs, tabsLoading]);

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

    return { slots, prefs, savePrefs, isLoading };
}
