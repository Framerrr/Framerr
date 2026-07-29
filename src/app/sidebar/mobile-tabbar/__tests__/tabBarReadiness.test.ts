import { describe, it, expect } from 'vitest';
import { computeTabBarLayoutReady } from '../tabBarReadiness';

describe('computeTabBarLayoutReady', () => {
    it('returns false while config is loading', () => {
        expect(
            computeTabBarLayoutReady({
                configLoading: true,
                hasIframeTabSlot: false,
                tabsLoaded: true,
            }),
        ).toBe(false);

        expect(
            computeTabBarLayoutReady({
                configLoading: true,
                hasIframeTabSlot: true,
                tabsLoaded: true,
            }),
        ).toBe(false);
    });

    it('returns true without waiting on tabs when no iframeTab slot is configured', () => {
        expect(
            computeTabBarLayoutReady({
                configLoading: false,
                hasIframeTabSlot: false,
                tabsLoaded: false,
            }),
        ).toBe(true);
    });

    it('returns false when iframeTab slot exists but tabs have not loaded', () => {
        expect(
            computeTabBarLayoutReady({
                configLoading: false,
                hasIframeTabSlot: true,
                tabsLoaded: false,
            }),
        ).toBe(false);
    });

    it('returns true when iframeTab slot exists and tabs have loaded', () => {
        expect(
            computeTabBarLayoutReady({
                configLoading: false,
                hasIframeTabSlot: true,
                tabsLoaded: true,
            }),
        ).toBe(true);
    });
});
