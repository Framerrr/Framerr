/**
 * Lidarr Widget Types
 *
 * Shared TypeScript interfaces for the Lidarr widget.
 * Shapes align with server/integrations/lidarr/poller.ts mappings.
 */

// ============================================================================
// LIDARR API SHAPES
// ============================================================================

/** Artist/album image from Lidarr API */
export interface LidarrImage {
    coverType: 'cover' | 'poster' | 'banner' | 'fanart' | string;
    url?: string;
    remoteUrl?: string;
}

/** Artist information from Lidarr API */
export interface LidarrArtist {
    artistName?: string;
    overview?: string;
    status?: string;
    genres?: string[];
    ratings?: {
        votes: number;
        value: number;
    };
    foreignArtistId?: string;
    images?: LidarrImage[];
    statistics?: {
        albumCount?: number;
        trackCount?: number;
        trackFileCount?: number;
    };
}

/** Calendar album from SSE */
export interface CalendarAlbum {
    id: number;
    artistId: number;
    artistName?: string;
    artist?: LidarrArtist;
    title?: string;
    releaseDate?: string;
    overview?: string;
    hasFile?: boolean;
    albumType?: string;
    images?: LidarrImage[];
    statistics?: {
        trackCount?: number;
        trackFileCount?: number;
    };
    /** True when this album has a file but doesn't meet the quality cutoff. Stamped client-side on fetch — never present on raw API responses. */
    cutoffNotMet?: boolean;
}

/** Missing/cutoff album from proxy API */
export interface WantedAlbum {
    id: number;
    artistId: number;
    title?: string;
    releaseDate?: string;
    overview?: string;
    hasFile?: boolean;
    albumType?: string;
    images?: LidarrImage[];
    statistics?: {
        trackCount?: number;
        trackFileCount?: number;
    };
    /** True when this album has a file but doesn't meet the quality cutoff. Stamped client-side on fetch — never present on raw API responses. */
    cutoffNotMet?: boolean;
    artist?: LidarrArtist;
}

/** Paginated response from wanted/missing and wanted/cutoff */
export interface WantedResponse {
    page: number;
    pageSize: number;
    totalRecords: number;
    records: WantedAlbum[];
}

/** Missing counts from SSE poller */
export interface MissingCounts {
    missingCount: number;
    cutoffUnmetCount: number;
    _meta?: { healthy: boolean; lastPoll?: string; errorCount?: number };
}

/** Release from interactive search */
export interface LidarrRelease {
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
    albumId?: number;
    status: string;
    trackedDownloadStatus?: string;
    trackedDownloadState?: string;
    progress?: number;
    timeleft?: string;
}

/** Data returned by useLidarrData hook */
export interface LidarrWidgetData {
    upcoming: CalendarAlbum[];
    missingCounts: MissingCounts | null;
    queueItems: QueueItem[];
    calendarConnected: boolean;
    calendarLoading: boolean;

    missingAlbums: WantedAlbum[];
    missingLoading: boolean;
    missingHasMore: boolean;
    loadMoreMissing: () => void;
    refreshMissing: () => void;

    cutoffAlbums: WantedAlbum[];
    cutoffLoading: boolean;
    cutoffHasMore: boolean;
    loadMoreCutoff: () => void;
    refreshCutoff: () => void;

    error: string | null;

    triggerAutoSearch: (albumIds: number[]) => Promise<boolean>;
    searchReleases: (albumId: number) => Promise<LidarrRelease[]>;
    grabRelease: (guid: string, indexerId: number, shouldOverride?: boolean) => Promise<boolean>;
}

/** Props for the album detail modal */
export interface AlbumDetailModalProps {
    album: WantedAlbum | CalendarAlbum | null;
    integrationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onActionComplete?: () => void;
}
