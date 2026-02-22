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
}

// ============================================================================
// URL GENERATORS
// ============================================================================

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
 */
export function getEmbyDeepLink(itemId: string, serverUrl: string): string {
    const baseUrl = serverUrl.replace(/\/$/, '');
    return `${baseUrl}/web/index.html#!/item?id=${itemId}`;
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
            return meta.serverUrl ? getEmbyDeepLink(itemId, meta.serverUrl) : null;
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
