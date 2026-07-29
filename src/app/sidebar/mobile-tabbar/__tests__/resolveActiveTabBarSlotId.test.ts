import { describe, it, expect } from 'vitest';
import {
    resolveActiveTabBarSlotId,
    tabBarSlotKey,
} from '../resolveActiveTabBarSlotId';
import type { TabBarSlot } from '../tabBarLayout';

const baseSlots: TabBarSlot[] = [
    { kind: 'menu' },
    { kind: 'dashboard', dashboardId: 'dash-a' },
    { kind: 'action', actionId: 'profile' },
    { kind: 'settings' },
];

describe('resolveActiveTabBarSlotId', () => {
    it('selects dashboard when on a dashboard hash', () => {
        expect(
            resolveActiveTabBarSlotId({
                slots: baseSlots,
                hash: 'dashboard/dash-a',
                activeDashboardId: 'dash-a',
                homeDashboardId: 'dash-a',
                tabs: [],
            }),
        ).toBe(tabBarSlotKey(baseSlots[1], 1));
    });

    it('selects profile action on profile settings route', () => {
        expect(
            resolveActiveTabBarSlotId({
                slots: baseSlots,
                hash: 'settings/account/profile',
                activeDashboardId: 'dash-a',
                homeDashboardId: 'dash-a',
                tabs: [],
            }),
        ).toBe('action-profile');
    });

    it('selects settings (not profile) on other settings routes', () => {
        expect(
            resolveActiveTabBarSlotId({
                slots: baseSlots,
                hash: 'settings/integrations',
                activeDashboardId: 'dash-a',
                homeDashboardId: 'dash-a',
                tabs: [],
            }),
        ).toBe(tabBarSlotKey(baseSlots[3], 3));
    });

    it('returns null when no slot matches', () => {
        expect(
            resolveActiveTabBarSlotId({
                slots: baseSlots,
                hash: 'some-iframe-tab',
                activeDashboardId: 'dash-a',
                homeDashboardId: 'dash-a',
                tabs: [],
            }),
        ).toBeNull();
    });
});
