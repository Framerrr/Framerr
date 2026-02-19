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
    tmdbId?: number;
    imdbId?: string;
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

// ============================================================================
// OVERSEERR TYPES
// ============================================================================

/**
 * Overseerr media status values:
 * 1 = Unknown, 2 = Pending, 3 = Processing, 4 = Partially Available, 5 = Available
 */
export type OverseerrMediaStatus = 1 | 2 | 3 | 4 | 5;

/**
 * Single result from Overseerr /api/v1/search (TMDB data + Overseerr mediaInfo).
 * Covers both movie and TV results.
 */
export interface OverseerrMediaResult {
    id: number;                    // TMDB ID
    mediaType: 'movie' | 'tv';
    title?: string;                // Movie title
    name?: string;                 // TV show name
    originalTitle?: string;
    originalName?: string;
    overview?: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    releaseDate?: string;          // Movies
    firstAirDate?: string;         // TV shows
    voteAverage?: number;
    genreIds?: number[];
    popularity?: number;

    /** Overseerr-added field: request/availability status */
    mediaInfo?: {
        id?: number;
        status: OverseerrMediaStatus;
        requests?: Array<{
            id: number;
            status: number;
            requestedBy?: { id: number; displayName?: string };
        }>;
        /** Enriched by backend: number of seasons with requests or availability (status >= 2) */
        requestedSeasonCount?: number;
        /** Enriched by backend: total number of seasons (excluding specials) */
        totalSeasonCount?: number;
    };
}

/**
 * Results group for a single Overseerr instance.
 */
export interface OverseerrSearchGroup {
    integrationId: string;
    integrationName: string;
    items: OverseerrMediaResult[];
    loading: boolean;
    error?: string;
}

/**
 * All Overseerr search results, keyed by integration instance ID.
 */
export type OverseerrSearchResults = Record<string, OverseerrSearchGroup>;

/**
 * State machine for the inline request button.
 * Mirrors LinkGrid's LinkState pattern with extensions.
 */
export type RequestButtonState =
    | 'idle'         // Default — clickable
    | 'loading'      // Spinner — in-flight request
    | 'success'      // Check ✓ — brief success then → 'requested'
    | 'error'        // ✗ — brief error then → 'idle' (1s reset)
    | 'requested'    // Permanent disabled state (already requested or after success)
    | 'available';   // Already available in library (badge, not clickable)
