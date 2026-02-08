/**
 * Jobs & Cache Types
 * 
 * Types for the Jobs & Cache settings page.
 */

/** Job status from the API */
export interface JobStatus {
    id: string;
    name: string;
    cronExpression: string;
    description: string;
    status: 'idle' | 'running';
    lastRun: string | null;
    nextRun: string | null;
}

/** TMDB metadata cache stats */
export interface TmdbMetadataStats {
    count: number;
    movieCount: number;
    tvCount: number;
}

/** TMDB image cache stats */
export interface TmdbImageStats {
    count: number;
    sizeBytes: number;
}

/** Search history stats */
export interface SearchHistoryStats {
    count: number;
}

/** Library cache per-integration stats */
export interface LibraryIntegrationStats {
    integrationId: string;
    displayName?: string;
    imageCount: number;
    sizeBytes: number;
}

/** Library cache aggregate stats */
export interface LibraryCacheStats {
    integrations: number;
    totalImages: number;
    sizeBytes: number;
}

/** Combined cache stats from the API */
export interface CacheStats {
    tmdbMetadata: TmdbMetadataStats;
    tmdbImages: TmdbImageStats;
    searchHistory: SearchHistoryStats;
    library: LibraryCacheStats;
    libraryPerIntegration: LibraryIntegrationStats[];
}

/** Global monitor defaults (used when creating new monitors) */
export interface MonitorDefaults {
    intervalSeconds: number;
    timeoutSeconds: number;
    retriesBeforeDown: number;
    degradedThresholdMs: number;
    expectedStatusCodes: string[];
}
