/**
 * Link Grid navigation helpers — dashboard deep links vs external URLs.
 */

import type { Link, LinkTarget } from '../types';

/**
 * Extract a dashboard id from a Framerr deep link, if present.
 * Supports `#dashboard/{id}`, `/#dashboard/{id}`, and same-origin absolute URLs.
 */
export function parseDashboardDeepLink(raw: string): string | null {
    const value = (raw || '').trim();
    if (!value) return null;

    const fromHash = (hash: string): string | null => {
        const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
        if (!normalized.startsWith('dashboard/')) return null;
        const id = normalized.slice('dashboard/'.length).split(/[/?#]/)[0];
        return id || null;
    };

    if (value.startsWith('#') || value.startsWith('/#')) {
        const hash = value.startsWith('/#') ? value.slice(1) : value;
        return fromHash(hash);
    }

    try {
        const url = new URL(value, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        const sameOrigin =
            typeof window === 'undefined' || url.origin === window.location.origin;
        if (sameOrigin && url.hash) {
            return fromHash(url.hash);
        }
    } catch {
        // not a URL
    }

    return null;
}

/** True when the URL is an in-app hash route (#… or /#…). */
export function isInAppHashUrl(raw: string): boolean {
    const value = (raw || '').trim();
    return value.startsWith('#') || value.startsWith('/#');
}

export function dashboardHash(dashboardId: string): string {
    return `#dashboard/${dashboardId}`;
}

export interface ResolvedLinkNavigation {
    kind: 'dashboard' | 'hash' | 'external';
    /** Hash without leading # for location.hash assignment */
    hash?: string;
    dashboardId?: string;
    url?: string;
    openInNewTab: boolean;
}

/**
 * Resolve how a link should open at click time.
 * Dashboard / same-app deep links always stay in the current tab.
 */
export function resolveLinkNavigation(link: Link): ResolvedLinkNavigation {
    const rawUrl = link.url ?? '';

    if (link.linkTarget === 'dashboard' && link.dashboardId) {
        return {
            kind: 'dashboard',
            dashboardId: link.dashboardId,
            hash: `dashboard/${link.dashboardId}`,
            openInNewTab: false,
        };
    }

    const dashboardId = parseDashboardDeepLink(rawUrl);
    if (dashboardId) {
        return {
            kind: 'dashboard',
            dashboardId,
            hash: `dashboard/${dashboardId}`,
            openInNewTab: false,
        };
    }

    if (isInAppHashUrl(rawUrl)) {
        const hash = rawUrl.startsWith('/#') ? rawUrl.slice(2) : rawUrl.slice(1);
        return {
            kind: 'hash',
            hash,
            openInNewTab: false,
        };
    }

    return {
        kind: 'external',
        url: rawUrl,
        openInNewTab: link.openInNewTab !== false,
    };
}

/** Infer form target fields when editing an existing link or library template. */
export function inferLinkTargetFields(link: Partial<Link> | null | undefined): {
    linkTarget: LinkTarget;
    dashboardId: string;
    openInNewTab: boolean;
    url: string;
} {
    const url = link?.url || '';
    const storedDashboardId =
        link?.dashboardId ||
        link?.style?.dashboardId ||
        parseDashboardDeepLink(url) ||
        '';
    const linkTarget: LinkTarget =
        link?.linkTarget === 'dashboard' ||
        link?.style?.linkTarget === 'dashboard' ||
        !!storedDashboardId
            ? 'dashboard'
            : 'url';

    const openInNewTab =
        link?.openInNewTab ??
        link?.style?.openInNewTab ??
        true;

    return {
        linkTarget,
        dashboardId: storedDashboardId,
        openInNewTab: openInNewTab !== false,
        url: linkTarget === 'dashboard' && storedDashboardId
            ? dashboardHash(storedDashboardId)
            : url,
    };
}
