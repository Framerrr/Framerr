import { describe, it, expect } from 'vitest';
import {
    DEFAULT_TAB_BAR_PREFS,
    createDefaultTabBarPrefs,
    MAX_TAB_BAR_SLOTS,
    canRemoveSlot,
    moveSlot,
    removeSlotAt,
    resolveTabBarLayout,
    sanitizeTabBarPrefs,
    insertSlot,
    prefsDeepEqual,
    replaceSlot,
    type MobileTabBarPrefs,
} from '../tabBarLayout';
import type { Link } from '@/widgets/link-grid/types';

const KNOWN = new Set(['profile', 'notifications']);

function makeLink(overrides: Partial<Link> = {}): Link {
    return {
        id: 'link-1',
        title: 'Test',
        icon: 'Link',
        size: 'circle',
        type: 'link',
        url: 'https://example.com',
        style: { showIcon: true, showText: true },
        ...overrides,
    };
}

function linkSlot(link: Partial<Link> = {}) {
    return { kind: 'link' as const, link: makeLink(link) };
}

function kinds(prefs: MobileTabBarPrefs | undefined): string[] {
    return resolveTabBarLayout(prefs, KNOWN).map(s =>
        s.kind === 'action' ? `action:${s.actionId}` : s.kind === 'dashboard' ? `dashboard:${s.dashboardId ?? 'active'}` : s.kind,
    );
}

describe('tabBarLayout v2', () => {
    it('P1: undefined prefs resolve to default Menu · Dashboard · Profile · Settings', () => {
        expect(kinds(undefined)).toEqual([
            'menu',
            'dashboard:active',
            'action:profile',
            'settings',
        ]);
    });

    it('binds factory default (and v1 migration) to Home when provided', () => {
        expect(kinds(sanitizeTabBarPrefs(null, KNOWN, 'home-1'))).toEqual([
            'menu',
            'dashboard:home-1',
            'action:profile',
            'settings',
        ]);
        expect(createDefaultTabBarPrefs('home-1').slots[1]).toEqual({
            kind: 'dashboard',
            dashboardId: 'home-1',
        });
        const migrated = sanitizeTabBarPrefs(
            { version: 1, left: ['notifications'], right: ['profile'] },
            KNOWN,
            'home-1',
        );
        expect(kinds(migrated)).toEqual([
            'menu',
            'action:notifications',
            'dashboard:home-1',
            'action:profile',
            'settings',
        ]);
    });

    it('remaps legacy Current (null) bindings to Home when known', () => {
        const raw = {
            version: 2,
            slots: [
                { kind: 'menu' },
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(kinds(sanitizeTabBarPrefs(raw, KNOWN, 'home-1'))).toEqual([
            'menu',
            'dashboard:home-1',
            'settings',
        ]);
    });

    it('migrates v1 left/right prefs into ordered slots', () => {
        const raw = { version: 1, left: ['notifications'], right: ['profile'] };
        expect(kinds(sanitizeTabBarPrefs(raw, KNOWN))).toEqual([
            'menu',
            'action:notifications',
            'dashboard:active',
            'action:profile',
            'settings',
        ]);
    });

    it('requires menu, settings, and at least one dashboard', () => {
        const raw = {
            version: 2,
            slots: [{ kind: 'action', actionId: 'profile' }],
        };
        const slots = resolveTabBarLayout(sanitizeTabBarPrefs(raw, KNOWN), KNOWN);
        expect(slots.some(s => s.kind === 'menu')).toBe(true);
        expect(slots.some(s => s.kind === 'settings')).toBe(true);
        expect(slots.filter(s => s.kind === 'dashboard').length).toBeGreaterThanOrEqual(1);
    });

    it('preserves distinct dashboard bindings across sanitize', () => {
        const raw = {
            version: 2,
            slots: [
                { kind: 'menu' },
                { kind: 'dashboard', dashboardId: 'dash-a' },
                { kind: 'dashboard', dashboardId: 'dash-b' },
                { kind: 'settings' },
            ],
            // legacy keys that deepMerge may leave behind
            left: [],
            right: ['profile'],
        };
        expect(kinds(sanitizeTabBarPrefs(raw, KNOWN))).toEqual([
            'menu',
            'dashboard:dash-a',
            'dashboard:dash-b',
            'settings',
        ]);
    });

    it('strips legacy per-slot icons (icons live on dashboard entity)', () => {
        const raw = {
            version: 2,
            slots: [
                { kind: 'menu' },
                { kind: 'dashboard', dashboardId: 'dash-a', icon: 'Film' },
                { kind: 'dashboard', dashboardId: 'dash-b', icon: null },
                { kind: 'settings' },
            ],
        };
        const slots = sanitizeTabBarPrefs(raw, KNOWN).slots;
        const a = slots.find(s => s.kind === 'dashboard' && s.dashboardId === 'dash-a');
        expect(a).toEqual({ kind: 'dashboard', dashboardId: 'dash-a' });
        expect(a && 'icon' in a).toBe(false);
    });

    it('allows reordering menu/settings/dashboard', () => {
        const start = sanitizeTabBarPrefs(
            {
                version: 2,
                slots: [
                    { kind: 'menu' },
                    { kind: 'dashboard', dashboardId: null },
                    { kind: 'settings' },
                ],
            },
            KNOWN,
        );
        const moved = moveSlot(start, 0, 2); // menu to end
        expect(kinds(moved)).toEqual(['dashboard:active', 'settings', 'menu']);
    });

    it('cannot remove the last dashboard or menu/settings', () => {
        const prefs = sanitizeTabBarPrefs(
            {
                version: 2,
                slots: [
                    { kind: 'menu' },
                    { kind: 'dashboard', dashboardId: null },
                    { kind: 'settings' },
                ],
            },
            KNOWN,
        );
        expect(canRemoveSlot(prefs, 0)).toBe(false);
        expect(canRemoveSlot(prefs, 1)).toBe(false);
        expect(canRemoveSlot(prefs, 2)).toBe(false);
        expect(removeSlotAt(prefs, 1)).toEqual(prefs);
    });

    it('can remove an extra dashboard or an action', () => {
        const prefs = sanitizeTabBarPrefs(
            {
                version: 2,
                slots: [
                    { kind: 'menu' },
                    { kind: 'dashboard', dashboardId: null },
                    { kind: 'dashboard', dashboardId: 'd2' },
                    { kind: 'action', actionId: 'profile' },
                    { kind: 'settings' },
                ],
            },
            KNOWN,
        );
        expect(canRemoveSlot(prefs, 2)).toBe(true);
        expect(canRemoveSlot(prefs, 3)).toBe(true);
        expect(removeSlotAt(prefs, 3).slots).toHaveLength(4);
    });

    it('caps at MAX_TAB_BAR_SLOTS', () => {
        const raw = {
            version: 2,
            slots: [
                { kind: 'menu' },
                { kind: 'dashboard', dashboardId: null },
                { kind: 'action', actionId: 'profile' },
                { kind: 'action', actionId: 'notifications' },
                { kind: 'dashboard', dashboardId: 'x' },
                { kind: 'settings' },
            ],
        };
        const slots = sanitizeTabBarPrefs(raw, KNOWN).slots;
        expect(slots.length).toBeLessThanOrEqual(MAX_TAB_BAR_SLOTS);
        expect(slots.some(s => s.kind === 'menu')).toBe(true);
        expect(slots.some(s => s.kind === 'settings')).toBe(true);
        expect(slots.some(s => s.kind === 'dashboard')).toBe(true);
    });

    it('insertSlot no-ops at capacity', () => {
        const full = sanitizeTabBarPrefs(
            {
                version: 2,
                slots: [
                    { kind: 'menu' },
                    { kind: 'dashboard', dashboardId: null },
                    { kind: 'action', actionId: 'profile' },
                    { kind: 'action', actionId: 'notifications' },
                    { kind: 'settings' },
                ],
            },
            KNOWN,
        );
        expect(full.slots).toHaveLength(MAX_TAB_BAR_SLOTS);
        expect(insertSlot(full, 2, { kind: 'dashboard', dashboardId: null }, KNOWN)).toEqual(full);
    });

    it('garbage input falls back to default', () => {
        expect(sanitizeTabBarPrefs(null, KNOWN)).toEqual(DEFAULT_TAB_BAR_PREFS);
        expect(sanitizeTabBarPrefs('nope', KNOWN)).toEqual(DEFAULT_TAB_BAR_PREFS);
    });

    it('slot count always between 3 and 5', () => {
        const samples = [
            undefined,
            DEFAULT_TAB_BAR_PREFS,
            { version: 1 as const, left: [], right: [] },
            { version: 1 as const, left: ['profile', 'notifications'], right: [] },
        ];
        for (const sample of samples) {
            const n = resolveTabBarLayout(sample as MobileTabBarPrefs | undefined, KNOWN).length;
            expect(n).toBeGreaterThanOrEqual(3);
            expect(n).toBeLessThanOrEqual(5);
        }
    });
});

describe('tabBarLayout link slots', () => {
    it('round-trips a valid URL link slot through sanitizeTabBarPrefs', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({ url: 'https://example.com' }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        const slots = sanitizeTabBarPrefs(raw, KNOWN).slots;
        expect(slots.some(s => s.kind === 'link')).toBe(true);
        const linkSlotResult = slots.find(s => s.kind === 'link');
        expect(linkSlotResult && linkSlotResult.kind === 'link' && linkSlotResult.link.url).toBe(
            'https://example.com',
        );
    });

    it('round-trips a valid HTTP action link slot', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({
                    type: 'action',
                    url: undefined,
                    action: { method: 'GET', url: 'https://api.example.com/hook' },
                }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        const slots = sanitizeTabBarPrefs(raw, KNOWN).slots;
        expect(slots.filter(s => s.kind === 'link')).toHaveLength(1);
    });

    it('drops link slot with linkTarget dashboard', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({ linkTarget: 'dashboard', dashboardId: 'dash-x', url: '#dashboard/dash-x' }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'link')).toBe(false);
    });

    it('drops link slot with dashboardId only', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({ dashboardId: 'dash-x', url: '#dashboard/dash-x' }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'link')).toBe(false);
    });

    it('drops link slot with style.dashboardId', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({
                    url: '#dashboard/dash-x',
                    style: { showIcon: true, showText: true, dashboardId: 'dash-x' },
                }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'link')).toBe(false);
    });

    it('drops hash dashboard deep link without explicit dashboard fields', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({ url: '#dashboard/abc' }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'link')).toBe(false);
    });

    it('drops /#dashboard hash variant', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({ url: '/#dashboard/abc' }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'link')).toBe(false);
    });

    it('drops same-origin absolute dashboard URL', () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({ url: `${origin}/#dashboard/abc` }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'link')).toBe(false);
    });

    it('keeps cross-origin URL with dashboard-like hash fragment', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({ url: 'https://external-site.example/#dashboard/abc' }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'link')).toBe(true);
    });

    it('drops link with empty url', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({ url: '   ' }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'link')).toBe(false);
    });

    it('drops action link with missing action url', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({
                    type: 'action',
                    action: { method: 'GET', url: '' },
                }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'link')).toBe(false);
    });

    it('drops action link with invalid method', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                linkSlot({
                    type: 'action',
                    action: { method: 'BOGUS' as 'GET', url: 'https://api.example.com' },
                }),
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'link')).toBe(false);
    });

    it('evicts trailing action slot when six slots include a link before settings', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                { kind: 'dashboard', dashboardId: null },
                linkSlot({ id: 'new-link' }),
                { kind: 'action', actionId: 'profile' },
                { kind: 'action', actionId: 'notifications' },
                { kind: 'settings' },
            ],
        };
        const result = sanitizeTabBarPrefs(raw, KNOWN);
        expect(result.slots).toHaveLength(MAX_TAB_BAR_SLOTS);
        expect(result.slots.some(s => s.kind === 'link' && s.link.id === 'new-link')).toBe(true);
        expect(result.slots.filter(s => s.kind === 'action')).toHaveLength(1);
    });

    it('evicts the rearmost link slot when over capacity with mixed link kinds', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                { kind: 'dashboard', dashboardId: null },
                linkSlot({ id: 'link-a' }),
                linkSlot({ id: 'link-b' }),
                linkSlot({ id: 'link-c' }),
                { kind: 'settings' },
            ],
        };
        const withThird = sanitizeTabBarPrefs(raw, KNOWN);
        expect(withThird.slots).toHaveLength(MAX_TAB_BAR_SLOTS);
        const linkIds = withThird.slots
            .filter((s): s is Extract<typeof s, { kind: 'link' }> => s.kind === 'link')
            .map(s => s.link.id);
        expect(linkIds).toContain('link-a');
        expect(linkIds).toContain('link-b');
        expect(linkIds).not.toContain('link-c');
    });

    it('prefsDeepEqual compares link slots by link payload', () => {
        const a = sanitizeTabBarPrefs(
            {
                version: 2,
                slots: [
                    { kind: 'menu' },
                    linkSlot({ title: 'Same' }),
                    { kind: 'dashboard', dashboardId: null },
                    { kind: 'settings' },
                ],
            },
            KNOWN,
        );
        const b = sanitizeTabBarPrefs(
            {
                version: 2,
                slots: [
                    { kind: 'menu' },
                    linkSlot({ title: 'Same' }),
                    { kind: 'dashboard', dashboardId: null },
                    { kind: 'settings' },
                ],
            },
            KNOWN,
        );
        const c = sanitizeTabBarPrefs(
            {
                version: 2,
                slots: [
                    { kind: 'menu' },
                    linkSlot({ title: 'Different' }),
                    { kind: 'dashboard', dashboardId: null },
                    { kind: 'settings' },
                ],
            },
            KNOWN,
        );
        expect(prefsDeepEqual(a, b)).toBe(true);
        expect(prefsDeepEqual(a, c)).toBe(false);
    });

    it('resolveTabBarLayout preserves mixed slot order', () => {
        const prefs = sanitizeTabBarPrefs(
            {
                version: 2,
                slots: [
                    { kind: 'menu' },
                    linkSlot({ id: 'custom' }),
                    { kind: 'dashboard', dashboardId: 'd1' },
                    { kind: 'action', actionId: 'profile' },
                    { kind: 'settings' },
                ],
            },
            KNOWN,
        );
        expect(resolveTabBarLayout(prefs, KNOWN).map(s => s.kind)).toEqual([
            'menu',
            'link',
            'dashboard',
            'action',
            'settings',
        ]);
    });
});

describe('tabBarLayout iframeTab slots', () => {
    const KNOWN_TABS = new Set(['tab-a', 'tab-b']);

    const baseSlots = () => [
        { kind: 'menu' as const },
        { kind: 'dashboard' as const, dashboardId: null },
        { kind: 'settings' as const },
    ];

    it('round-trips a valid iframeTab through sanitizeTabBarPrefs', () => {
        const raw = {
            version: 2 as const,
            slots: [...baseSlots().slice(0, 2), { kind: 'iframeTab', tabId: 'tab-a' }, baseSlots()[2]],
        };
        const slots = sanitizeTabBarPrefs(raw, KNOWN).slots;
        expect(slots.some(s => s.kind === 'iframeTab' && s.tabId === 'tab-a')).toBe(true);
    });

    it('drops iframeTab with empty or whitespace tabId', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                { kind: 'iframeTab', tabId: '   ' },
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        expect(sanitizeTabBarPrefs(raw, KNOWN).slots.some(s => s.kind === 'iframeTab')).toBe(false);
    });

    it('dedupes duplicate tabId (first wins)', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                { kind: 'iframeTab', tabId: 'tab-a' },
                { kind: 'iframeTab', tabId: 'tab-a' },
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        const iframeSlots = sanitizeTabBarPrefs(raw, KNOWN).slots.filter(
            (s): s is Extract<typeof s, { kind: 'iframeTab' }> => s.kind === 'iframeTab',
        );
        expect(iframeSlots).toHaveLength(1);
        expect(iframeSlots[0].tabId).toBe('tab-a');
    });

    it('drops unknown tabId when knownTabIds provided; keeps known', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                { kind: 'iframeTab', tabId: 'tab-a' },
                { kind: 'iframeTab', tabId: 'orphan' },
                { kind: 'dashboard', dashboardId: null },
                { kind: 'settings' },
            ],
        };
        const slots = sanitizeTabBarPrefs(raw, KNOWN, null, KNOWN_TABS).slots;
        expect(slots.some(s => s.kind === 'iframeTab' && s.tabId === 'tab-a')).toBe(true);
        expect(slots.some(s => s.kind === 'iframeTab' && s.tabId === 'orphan')).toBe(false);
    });

    it('evicts rearmost iframeTab among mixed customs when over capacity', () => {
        const raw = {
            version: 2 as const,
            slots: [
                { kind: 'menu' },
                { kind: 'dashboard', dashboardId: null },
                linkSlot({ id: 'link-1' }),
                { kind: 'iframeTab', tabId: 'tab-a' },
                { kind: 'action', actionId: 'profile' },
                { kind: 'iframeTab', tabId: 'tab-b' },
                { kind: 'settings' },
            ],
        };
        const result = sanitizeTabBarPrefs(raw, KNOWN);
        expect(result.slots).toHaveLength(MAX_TAB_BAR_SLOTS);
        expect(result.slots.some(s => s.kind === 'iframeTab' && s.tabId === 'tab-a')).toBe(true);
        expect(result.slots.some(s => s.kind === 'iframeTab' && s.tabId === 'tab-b')).toBe(false);
    });

    it('prefsDeepEqual compares iframeTab by tabId', () => {
        const mk = (tabId: string) =>
            sanitizeTabBarPrefs(
                {
                    version: 2,
                    slots: [
                        { kind: 'menu' },
                        { kind: 'iframeTab', tabId },
                        { kind: 'dashboard', dashboardId: null },
                        { kind: 'settings' },
                    ],
                },
                KNOWN,
            );
        expect(prefsDeepEqual(mk('tab-a'), mk('tab-a'))).toBe(true);
        expect(prefsDeepEqual(mk('tab-a'), mk('tab-b'))).toBe(false);
    });
});
