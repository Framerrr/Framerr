import { describe, it, expect } from 'vitest';
import {
    parseDashboardDeepLink,
    resolveLinkNavigation,
    inferLinkTargetFields,
} from '../linkNavigation';

describe('parseDashboardDeepLink', () => {
    it('parses hash and /# forms', () => {
        expect(parseDashboardDeepLink('#dashboard/abc')).toBe('abc');
        expect(parseDashboardDeepLink('/#dashboard/abc')).toBe('abc');
    });

    it('parses same-origin absolute URLs', () => {
        expect(parseDashboardDeepLink(`${window.location.origin}/#dashboard/xyz`)).toBe('xyz');
    });

    it('returns null for external URLs', () => {
        expect(parseDashboardDeepLink('https://example.com/#dashboard/abc')).toBeNull();
        expect(parseDashboardDeepLink('https://plex.tv')).toBeNull();
    });
});

describe('resolveLinkNavigation', () => {
    it('uses dashboardId when linkTarget is dashboard', () => {
        expect(
            resolveLinkNavigation({
                id: '1',
                title: 'Home',
                icon: 'Home',
                size: 'circle',
                type: 'link',
                linkTarget: 'dashboard',
                dashboardId: 'dash-1',
            })
        ).toMatchObject({
            kind: 'dashboard',
            dashboardId: 'dash-1',
            openInNewTab: false,
        });
    });

    it('detects pasted same-origin copy links', () => {
        expect(
            resolveLinkNavigation({
                id: '1',
                title: 'Dash',
                icon: 'Link',
                size: 'circle',
                type: 'link',
                url: `${window.location.origin}/#dashboard/pasted`,
            })
        ).toMatchObject({
            kind: 'dashboard',
            dashboardId: 'pasted',
            openInNewTab: false,
        });
    });

    it('defaults external links to new tab', () => {
        expect(
            resolveLinkNavigation({
                id: '1',
                title: 'Plex',
                icon: 'Film',
                size: 'circle',
                type: 'link',
                url: 'https://plex.tv',
            }).openInNewTab
        ).toBe(true);
    });

    it('honors openInNewTab false for external links', () => {
        expect(
            resolveLinkNavigation({
                id: '1',
                title: 'Docs',
                icon: 'Book',
                size: 'circle',
                type: 'link',
                url: 'https://example.com',
                openInNewTab: false,
            }).openInNewTab
        ).toBe(false);
    });
});

describe('inferLinkTargetFields', () => {
    it('infers dashboard from stored fields and hash url', () => {
        expect(
            inferLinkTargetFields({
                url: '#dashboard/d1',
            })
        ).toMatchObject({
            linkTarget: 'dashboard',
            dashboardId: 'd1',
        });
    });
});
