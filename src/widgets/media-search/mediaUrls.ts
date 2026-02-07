/**
 * Media Search URL Utilities
 * 
 * Generates "Open in [App]" URLs for different media server integrations.
 */

import type { MediaItem } from './types';

// ============================================================================
// URL GENERATORS
// ============================================================================

/**
 * Generate a Plex Web URL for a media item
 * @param machineId - Plex server machineIdentifier
 * @param ratingKey - Media ratingKey (externalId from search)
 */
export function getPlexUrl(machineId: string, ratingKey: string): string {
    const encodedKey = encodeURIComponent(`/library/metadata/${ratingKey}`);
    return `https://app.plex.tv/desktop#!/server/${machineId}/details?key=${encodedKey}`;
}

/**
 * Generate a Jellyfin Web URL for a media item
 * @param serverUrl - Jellyfin server base URL
 * @param itemId - Item ID (externalId from search)
 */
export function getJellyfinUrl(serverUrl: string, itemId: string): string {
    // Jellyfin uses /web/index.html#!/details?id=ITEM_ID format
    const baseUrl = serverUrl.replace(/\/$/, '');
    return `${baseUrl}/web/index.html#!/details?id=${itemId}`;
}

/**
 * Generate an Emby Web URL for a media item
 * @param serverUrl - Emby server base URL
 * @param itemId - Item ID (externalId from search)
 */
export function getEmbyUrl(serverUrl: string, itemId: string): string {
    // Emby uses similar URL format to Jellyfin
    const baseUrl = serverUrl.replace(/\/$/, '');
    return `${baseUrl}/web/index.html#!/item?id=${itemId}`;
}

// ============================================================================
// OPEN IN APP
// ============================================================================

export interface IntegrationMeta {
    machineId?: string;  // Plex
    serverUrl?: string;  // Jellyfin/Emby
}

/**
 * Open a media item in its source application
 * @param item - The media item to open
 * @param meta - Integration metadata (machineId for Plex, serverUrl for Jellyfin/Emby)
 * @returns true if URL was opened, false if missing required data
 */
export function openInApp(item: MediaItem, meta: IntegrationMeta): boolean {
    let url: string | null = null;

    switch (item.integrationType) {
        case 'plex':
            if (meta.machineId && item.externalId) {
                url = getPlexUrl(meta.machineId, item.externalId);
            }
            break;
        case 'jellyfin':
            if (meta.serverUrl && item.externalId) {
                url = getJellyfinUrl(meta.serverUrl, item.externalId);
            }
            break;
        case 'emby':
            if (meta.serverUrl && item.externalId) {
                url = getEmbyUrl(meta.serverUrl, item.externalId);
            }
            break;
    }

    if (url) {
        window.open(url, '_blank');
        return true;
    }

    return false;
}
