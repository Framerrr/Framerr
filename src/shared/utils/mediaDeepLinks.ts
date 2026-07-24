/**
 * Media Deep Links — Shared Utility
 *
 * Single source of truth for generating "Open in [App]" URLs
 * for Plex, Jellyfin, and Emby media servers.
 *
 * Used by both media-stream and media-search widgets.
 */

export type MediaServerType = 'plex' | 'jellyfin' | 'emby';

export interface MediaServerMeta {
    machineId?: string;  // Plex only
    serverUrl?: string;  // Jellyfin/Emby only
    serverId?: string;   // Emby only — unique server identifier for deep links
}

/** Delay before opening Plex Web fallback when native app does not take over (ms). */
export const PLEX_IOS_FALLBACK_DELAY_MS = 1700;

// ============================================================================
// iOS CLIENT DETECTION
// ============================================================================

/**
 * Detect iOS / iPadOS client (including PWA on iPad iOS 13+).
 */
export function isIosClient(): boolean {
    const ua = navigator.userAgent;
    if (/iPhone|iPod|iPad/i.test(ua)) return true;
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    return false;
}

// ============================================================================
// URL GENERATORS
// ============================================================================

/**
 * Generate a native Plex iOS deep link using the preplay scheme.
 */
export function getPlexNativeLink(ratingKey: string, machineId: string): string {
    const encodedKey = encodeURIComponent(`/library/metadata/${ratingKey}`);
    return `plex://preplay/?metadataKey=${encodedKey}&server=${machineId}`;
}

/**
 * Attempt native Plex app on iOS; fall back to web URL if app does not open.
 */
export function openPlexNativeOrFallback(
    ratingKey: string,
    machineId: string,
    webFallbackUrl: string
): void {
    const deepLinkUrl = getPlexNativeLink(ratingKey, machineId);
    let resolved = false;

    const resolve = (): void => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisibilityChange);
    };

    const onVisibilityChange = (): void => {
        if (document.hidden) {
            resolve();
        }
    };

    const timer = setTimeout((): void => {
        if (!resolved && !document.hidden) {
            resolve();
            window.open(webFallbackUrl, '_blank');
        }
    }, PLEX_IOS_FALLBACK_DELAY_MS);

    document.addEventListener('visibilitychange', onVisibilityChange);

    window.location.href = deepLinkUrl;
}

/**
 * Generate a Plex Web URL for a media item.
 * @param ratingKey - Media ratingKey or item ID
 * @param machineId - Plex server machineIdentifier
 */
export function getPlexDeepLink(ratingKey: string, machineId: string): string {
    const encodedKey = encodeURIComponent(`/library/metadata/${ratingKey}`);
    return `https://app.plex.tv/desktop#!/server/${machineId}/details?key=${encodedKey}`;
}

/**
 * Generate a Jellyfin Web URL for a media item.
 * @param itemId - Item ID
 * @param serverUrl - Jellyfin server base URL
 */
export function getJellyfinDeepLink(itemId: string, serverUrl: string): string {
    const baseUrl = serverUrl.replace(/\/$/, '');
    return `${baseUrl}/web/index.html#!/details?id=${itemId}`;
}

/**
 * Generate an Emby Web URL for a media item.
 * @param itemId - Item ID
 * @param serverUrl - Emby server base URL
 * @param serverId - Optional Emby server identifier (prevents blank page)
 */
export function getEmbyDeepLink(itemId: string, serverUrl: string, serverId?: string): string {
    const baseUrl = serverUrl.replace(/\/$/, '');
    const url = `${baseUrl}/web/index.html#!/item?id=${itemId}`;
    return serverId ? `${url}&serverId=${serverId}` : url;
}

// ============================================================================
// UNIFIED DISPATCHER
// ============================================================================

/**
 * Get a deep link URL for any supported media server type.
 * Returns null if required metadata is missing.
 */
export function getMediaDeepLink(
    type: MediaServerType,
    itemId: string,
    meta: MediaServerMeta
): string | null {
    if (!itemId) return null;

    switch (type) {
        case 'plex':
            return meta.machineId ? getPlexDeepLink(itemId, meta.machineId) : null;
        case 'jellyfin':
            return meta.serverUrl ? getJellyfinDeepLink(itemId, meta.serverUrl) : null;
        case 'emby':
            return meta.serverUrl ? getEmbyDeepLink(itemId, meta.serverUrl, meta.serverId) : null;
        default:
            return null;
    }
}

/**
 * Open a media item in its source application.
 * @returns true if URL was opened, false if missing required data
 */
export function openMediaInApp(
    type: MediaServerType,
    itemId: string,
    meta: MediaServerMeta
): boolean {
    if (type === 'plex' && meta.machineId && itemId && isIosClient()) {
        const webUrl = getPlexDeepLink(itemId, meta.machineId);
        openPlexNativeOrFallback(itemId, meta.machineId, webUrl);
        return true;
    }

    const url = getMediaDeepLink(type, itemId, meta);
    if (url) {
        window.open(url, '_blank');
        return true;
    }
    return false;
}

/**
 * Get the display name for an integration type.
 */
export function getMediaServerDisplayName(type: MediaServerType): string {
    switch (type) {
        case 'plex': return 'Plex';
        case 'jellyfin': return 'Jellyfin';
        case 'emby': return 'Emby';
    }
}
