import type { Tab } from '@/api/endpoints/tabs';
import { isDashboardHashActive } from '@/components/sidebar/dashboardNavUtils';
import { TAB_BAR_ACTIONS } from './tabBarActionRegistry';
import type { TabBarSlot } from './tabBarLayout';

export interface ResolveActiveTabBarSlotIdArgs {
    slots: TabBarSlot[];
    hash: string;
    activeDashboardId: string | null | undefined;
    homeDashboardId: string | null | undefined;
    tabs: Tab[] | null | undefined;
}

/**
 * Which bottom-bar slot owns the selection indicator for the current route.
 * Same rules as the previous per-slot `layoutId` mounts (Profile vs Settings, etc.).
 */
export function resolveActiveTabBarSlotId({
    slots,
    hash,
    activeDashboardId,
    homeDashboardId,
    tabs,
}: ResolveActiveTabBarSlotIdArgs): string | null {
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const slotKey = tabBarSlotKey(slot, i);

        if (slot.kind === 'dashboard') {
            const boundId = slot.dashboardId ?? homeDashboardId;
            if (
                boundId != null &&
                boundId === activeDashboardId &&
                isDashboardHashActive(hash)
            ) {
                return slotKey;
            }
            continue;
        }

        if (slot.kind === 'settings') {
            const isProfilePage =
                hash === 'settings/account/profile' ||
                hash.startsWith('settings/account/profile?');
            if (hash.startsWith('settings') && !isProfilePage) {
                return slotKey;
            }
            continue;
        }

        if (slot.kind === 'action') {
            const def = TAB_BAR_ACTIONS[slot.actionId];
            if (def?.kind === 'navigate' && def.isActive(hash)) {
                return slotKey;
            }
            continue;
        }

        if (slot.kind === 'iframeTab') {
            const tab = tabs?.find(t => t.id === slot.tabId && t.enabled !== false);
            if (tab && !tab.openInNewTab && !!tab.slug && hash === tab.slug) {
                return slotKey;
            }
        }
    }

    return null;
}

/**
 * True when the user is on a dashboard route whose active dashboard is not
 * bound to any bottom-bar dashboard slot (e.g. switched via hold-switcher).
 * Used to drop the selection pill's last geometry so the next real slot snap
 * does not reappear on the stale bound-dashboard position.
 */
export function isActiveDashboardMissingFromTabBar({
    slots,
    hash,
    activeDashboardId,
    homeDashboardId,
}: {
    slots: TabBarSlot[];
    hash: string;
    activeDashboardId: string | null | undefined;
    homeDashboardId: string | null | undefined;
}): boolean {
    if (!isDashboardHashActive(hash) || activeDashboardId == null) {
        return false;
    }
    return !slots.some(slot => {
        if (slot.kind !== 'dashboard') return false;
        const boundId = slot.dashboardId ?? homeDashboardId;
        return boundId != null && boundId === activeDashboardId;
    });
}

export function tabBarSlotKey(slot: TabBarSlot, index: number): string {
    switch (slot.kind) {
        case 'menu':
            return `menu-${index}`;
        case 'dashboard':
            return `dashboard-${index}-${slot.dashboardId ?? 'home'}`;
        case 'settings':
            return `settings-${index}`;
        case 'link':
            return `link-${index}-${slot.link.id}`;
        case 'iframeTab':
            return `iframeTab-${index}-${slot.tabId}`;
        case 'action':
            return `action-${slot.actionId}`;
    }
}
