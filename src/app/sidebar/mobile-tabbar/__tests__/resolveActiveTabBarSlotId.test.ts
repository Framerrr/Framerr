import { describe, it, expect } from 'vitest';
import {
    resolveActiveTabBarSlotId,
    tabBarSlotKey,
    isActiveDashboardMissingFromTabBar,
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

    it('returns null when active dashboard is not bound to the bar', () => {
        expect(
            resolveActiveTabBarSlotId({
                slots: baseSlots,
                hash: 'dashboard/dash-b',
                activeDashboardId: 'dash-b',
                homeDashboardId: 'dash-a',
                tabs: [],
            }),
        ).toBeNull();
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

    it('selects settings even when active dashboard is unbound', () => {
        expect(
            resolveActiveTabBarSlotId({
                slots: baseSlots,
                hash: 'settings/integrations',
                activeDashboardId: 'dash-b',
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

describe('isActiveDashboardMissingFromTabBar', () => {
    it('is true on an unbound dashboard route', () => {
        expect(
            isActiveDashboardMissingFromTabBar({
                slots: baseSlots,
                hash: 'dashboard/dash-b',
                activeDashboardId: 'dash-b',
                homeDashboardId: 'dash-a',
            }),
        ).toBe(true);
    });

    it('is false when the active dashboard is bound', () => {
        expect(
            isActiveDashboardMissingFromTabBar({
                slots: baseSlots,
                hash: 'dashboard/dash-a',
                activeDashboardId: 'dash-a',
                homeDashboardId: 'dash-a',
            }),
        ).toBe(false);
    });

    it('is false on non-dashboard routes', () => {
        expect(
            isActiveDashboardMissingFromTabBar({
                slots: baseSlots,
                hash: 'settings/integrations',
                activeDashboardId: 'dash-b',
                homeDashboardId: 'dash-a',
            }),
        ).toBe(false);
    });
});
