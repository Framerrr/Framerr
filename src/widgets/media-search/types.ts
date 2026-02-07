/**
 * Media Search Widget Types
 */

export interface MediaItem {
    id: string;
    externalId: string;
    title: string;
    year?: number;
    mediaType: 'movie' | 'show';
    posterUrl?: string;
    summary?: string;
    rating?: number;
    genres?: string[];
    actors?: string[];
    directors?: string[];
    resolution?: string;
    integrationId: string;
    integrationName: string;
    integrationType: 'plex' | 'jellyfin' | 'emby';
}

export interface SearchResults {
    [integrationId: string]: {
        integrationName: string;
        integrationType: 'plex' | 'jellyfin' | 'emby';
        items: MediaItem[];
        loading?: boolean;
        error?: string;
        totalMatches?: number;
        hasMore?: boolean;
    };
}

export interface RecentSearch {
    query: string;
    timestamp: number;
}
