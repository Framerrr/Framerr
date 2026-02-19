/**
 * Sonarr Widget Types
 * 
 * Shared TypeScript interfaces for the Sonarr widget.
 */

// ============================================================================
// SONARR API SHAPES
// ============================================================================

/** Series poster/fanart image from Sonarr API */
export interface SonarrImage {
    coverType: 'poster' | 'banner' | 'fanart';
    url?: string;
    remoteUrl?: string;
}

/** Series information from Sonarr API */
export interface SonarrSeries {
    id: number;
    title: string;
    overview?: string;
    year?: number;
    images?: SonarrImage[];
    path?: string;
    qualityProfileId?: number;
    status?: string; // 'continuing', 'ended', 'upcoming', 'deleted'
    /** Sonarr API ratings object */
    ratings?: {
        votes: number;
        value: number; // 0-10 scale
    };
    tvdbId?: number;
    imdbId?: string;
    tvMazeId?: number;
    /** Genres from Sonarr (e.g., ["Drama", "Sci-Fi"]) */
    genres?: string[];
    /** TV network (e.g., "HBO", "Netflix") */
    network?: string;
}

/** Calendar episode from SSE */
export interface CalendarEpisode {
    id: number;
    seriesId: number;
    seriesTitle?: string;
    series?: SonarrSeries;
    title?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    airDate?: string;
    airDateUtc?: string;
    overview?: string;
    hasFile?: boolean;
}

/** Missing/cutoff episode from proxy API */
export interface WantedEpisode {
    id: number;
    seriesId: number;
    title?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    airDate?: string;
    airDateUtc?: string;
    overview?: string;
    hasFile?: boolean;
    series?: SonarrSeries;
}

/** Paginated response from wanted/missing and wanted/cutoff */
export interface WantedResponse {
    page: number;
    pageSize: number;
    totalRecords: number;
    records: WantedEpisode[];
}

/** Missing counts from SSE poller */
export interface MissingCounts {
    missingCount: number;
    cutoffUnmetCount: number;
    _meta?: { healthy: boolean; lastPoll?: string; errorCount?: number };
}

/** Release from interactive search */
export interface SonarrRelease {
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
    episodeId?: number;
    movieId?: number;
    status: string;               // 'downloading' | 'delay' | 'completed' | 'failed' | etc.
    trackedDownloadStatus?: string; // 'ok' | 'warning' | 'error'
    trackedDownloadState?: string;  // 'downloading' | 'importPending' | 'importing' | 'failedPending'
}

/** Data returned by useSonarrData hook */
export interface SonarrWidgetData {
    // From SSE
    upcoming: CalendarEpisode[];
    missingCounts: MissingCounts | null;
    queueItems: QueueItem[];
    calendarConnected: boolean;
    calendarLoading: boolean;

    // Missing list (on-demand fetch)
    missingEpisodes: WantedEpisode[];
    missingLoading: boolean;
    missingHasMore: boolean;
    loadMoreMissing: () => void;
    refreshMissing: () => void;

    // Error
    error: string | null;

    // Actions (admin only)
    triggerAutoSearch: (episodeIds: number[]) => Promise<boolean>;
    searchReleases: (episodeId: number) => Promise<SonarrRelease[]>;
    grabRelease: (guid: string, indexerId: number, shouldOverride?: boolean) => Promise<boolean>;
}

/** Props for the episode detail modal */
export interface EpisodeDetailModalProps {
    episode: WantedEpisode | CalendarEpisode | null;
    integrationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onActionComplete?: () => void;
}
