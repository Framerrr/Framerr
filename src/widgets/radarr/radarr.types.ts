/**
 * Radarr Widget Types
 * 
 * Shared TypeScript interfaces for the Radarr widget.
 */

// ============================================================================
// RADARR API SHAPES
// ============================================================================

/** Movie poster/fanart image from Radarr API */
export interface RadarrImage {
    coverType: 'poster' | 'banner' | 'fanart';
    url?: string;
    remoteUrl?: string;
}

/** Calendar movie from SSE */
export interface CalendarMovie {
    id: number;
    title: string;
    overview?: string;
    inCinemas?: string;
    digitalRelease?: string;
    physicalRelease?: string;
    year?: number;
    tmdbId?: number;
    imdbId?: string;
    studio?: string;
    genres?: string[];
    ratings?: { votes: number; value: number };
    images?: RadarrImage[];
    hasFile?: boolean;
    status?: string; // 'released', 'announced', 'inCinemas'
    /** Radarr's native cutoff-quality flag. Only meaningful when hasFile is true. */
    cutoffNotMet?: boolean;
}

/** Missing/wanted movie from proxy API */
export interface WantedMovie {
    id: number;
    title: string;
    overview?: string;
    inCinemas?: string;
    digitalRelease?: string;
    physicalRelease?: string;
    year?: number;
    tmdbId?: number;
    imdbId?: string;
    studio?: string;
    genres?: string[];
    ratings?: { votes: number; value: number };
    images?: RadarrImage[];
    hasFile?: boolean;
    status?: string;
    /** Radarr's native cutoff-quality flag. True when on-disk but below target quality. */
    cutoffNotMet?: boolean;
}

/** Paginated response from wanted/missing and wanted/cutoff */
export interface WantedMovieResponse {
    page: number;
    pageSize: number;
    totalRecords: number;
    records: WantedMovie[];
}

/** Missing counts from SSE poller */
export interface MissingCounts {
    missingCount: number;
    cutoffUnmetCount: number;
    _meta?: { healthy: boolean; lastPoll?: string; errorCount?: number };
}

/** Release from interactive search */
export interface RadarrRelease {
    guid: string;
    quality: {
        quality: {
            id: number;
            name: string;
        };
    };
    title: string;
    size: number;
    indexer?: string;
    indexerId: number;
    seeders?: number;
    leechers?: number;
    protocol: 'torrent' | 'usenet';
    age?: number;
    ageHours?: number;
    rejected?: boolean;
    rejections?: string[];
}

// ============================================================================
// WIDGET-SPECIFIC SHAPES
// ============================================================================

/** Queue item from SSE — used to enrich missing list with download state */
export interface QueueItem {
    id: number;
    movieId?: number;
    status: string;               // 'downloading' | 'delay' | 'completed' | 'failed' | etc.
    trackedDownloadStatus?: string; // 'ok' | 'warning' | 'error'
    trackedDownloadState?: string;  // 'downloading' | 'importPending' | 'importing' | 'failedPending'
    progress?: number;
    timeleft?: string;
}

/** 7-state release-date decision tree output (spec §1.4) */
export type MovieDisplayState = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface MovieDisplayInfo {
    state: MovieDisplayState;
    displayDate: string | null;
    displayType: 'cinema' | 'digital' | 'physical' | null;
    sortKey: number;
}

/** Config-driven release-type visibility flags (spec §1.8's `showReleasePills`, reshaped) */
export interface ReleaseTypeVisibility {
    showCinema: boolean;
    showDigital: boolean;
    showPhysical: boolean;
}

/** Data returned by useRadarrData hook */
export interface RadarrWidgetData {
    // From SSE
    upcoming: CalendarMovie[];
    /** Display info for each `upcoming` movie, computed once (correctly, per the active `sortBy` mode) at fetch time — keyed by movie id. Consumers (HeroCard, UpcomingCarousel) must look up here rather than recomputing, since recomputing via the 7-state tree would give the wrong answer whenever `sortBy` is a strict date-type mode. */
    upcomingDisplay: Map<number, MovieDisplayInfo>;
    missingCounts: MissingCounts | null;
    queueItems: QueueItem[];
    calendarConnected: boolean;
    calendarLoading: boolean;

    // Missing list (on-demand fetch)
    missingMovies: WantedMovie[];
    missingLoading: boolean;
    missingHasMore: boolean;
    loadMoreMissing: () => void;
    refreshMissing: () => void;

    // Cutoff-unmet list (on-demand fetch)
    cutoffMovies: WantedMovie[];
    cutoffLoading: boolean;
    cutoffHasMore: boolean;
    loadMoreCutoff: () => void;
    refreshCutoff: () => void;

    // Error
    error: string | null;

    // Actions (admin only)
    triggerAutoSearch: (movieIds: number[]) => Promise<boolean>;
    searchReleases: (movieId: number) => Promise<RadarrRelease[]>;
    grabRelease: (guid: string, indexerId: number, shouldOverride?: boolean) => Promise<boolean>;
}

/** Props for the movie detail modal */
export interface MovieDetailModalProps {
    movie: WantedMovie | CalendarMovie | null;
    integrationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    triggerAutoSearch: (movieIds: number[]) => Promise<boolean>;
    searchReleases: (movieId: number) => Promise<RadarrRelease[]>;
    grabRelease: (guid: string, indexerId: number, shouldOverride?: boolean) => Promise<boolean>;
    onActionComplete?: () => void;
}
