import { PluginInstance, PluginAdapter } from '../types';

// ============================================================================
// LIDARR POLLER
// ============================================================================

/** Polling interval in milliseconds */
export const intervalMs = 5000;

/** Queue item shape for Lidarr */
export interface LidarrQueueItem {
    id: number;
    artistId?: number;
    albumId?: number;
    artist?: {
        artistName?: string;
        foreignArtistId?: string;
    };
    album?: {
        title?: string;
        albumType?: string;
    };
    size?: number;
    sizeleft?: number;
    progress: number;
    timeleft?: string;
    status: string;
    trackedDownloadStatus?: string;  // 'ok' | 'warning' | 'error'
    trackedDownloadState?: string;   // 'downloading' | 'importPending' | 'importing' | 'failedPending'
}

/**
 * Poll Lidarr queue for a specific instance.
 * Returns the current download queue with progress information.
 */
export async function poll(instance: PluginInstance, adapter: PluginAdapter): Promise<LidarrQueueItem[]> {
    const response = await adapter.get!(instance, '/api/v1/queue', {
        params: { includeArtist: true, includeAlbum: true, pageSize: 500 },
        timeout: 10000,
    });

    return (response.data.records || []).map((item: Record<string, unknown>) => ({
        id: item.id,
        artistId: item.artistId,
        albumId: item.albumId,
        artist: (item.artist as Record<string, unknown>)
            ? {
                artistName: (item.artist as Record<string, unknown>).artistName,
                foreignArtistId: (item.artist as Record<string, unknown>).foreignArtistId,
            }
            : null,
        album: (item.album as Record<string, unknown>)
            ? {
                title: (item.album as Record<string, unknown>).title,
                albumType: (item.album as Record<string, unknown>).albumType,
            }
            : null,
        size: item.size,
        sizeleft: item.sizeleft,
        progress:
            (item.size as number) > 0
                ? Math.round((((item.size as number) - (item.sizeleft as number)) / (item.size as number)) * 100)
                : 0,
        timeleft: item.timeleft as string | undefined,
        status: item.status as string,
        trackedDownloadStatus: item.trackedDownloadStatus as string | undefined,
        trackedDownloadState: item.trackedDownloadState as string | undefined,
    }));
}

// ============================================================================
// CALENDAR SUBTYPE
// ============================================================================

/** Calendar polling interval (longer than queue since calendar changes less frequently) */
export const calendarIntervalMs = 60000; // 1 minute

/** Calendar album shape */
export interface CalendarAlbum {
    id: number;
    artistId: number;
    artistName?: string;
    artist?: {
        artistName?: string;
        overview?: string;
        status?: string;
        genres?: string[];
        ratings?: { votes: number; value: number };
        foreignArtistId?: string;
        images?: { coverType: string; url?: string; remoteUrl?: string }[];
        statistics?: { albumCount?: number; trackCount?: number; trackFileCount?: number };
    };
    title?: string;
    releaseDate?: string;
    overview?: string;
    hasFile?: boolean;
    albumType?: string;
    /** Album cover art from Lidarr AlbumResource — prefer over artist images in the widget. */
    images?: { coverType: string; url?: string; remoteUrl?: string }[];
    statistics?: {
        trackCount?: number;
        trackFileCount?: number;
    };
}

/**
 * Poll Lidarr calendar for a specific instance.
 * Wide feed window so Calendar / Radarr / Sonarr / Lidarr widgets can filter per-config
 * (including look-ahead/back "all"). Keep in sync with Radarr pollCalendar and
 * CalendarWidget FEED_* constants: 365 days past → 730 days future.
 */
export async function pollCalendar(instance: PluginInstance, adapter: PluginAdapter): Promise<CalendarAlbum[]> {
    const now = Date.now();
    const MS_DAY = 24 * 60 * 60 * 1000;
    const startDate = new Date(now - 365 * MS_DAY).toISOString().split('T')[0];
    const endDate = new Date(now + 730 * MS_DAY).toISOString().split('T')[0];

    const response = await adapter.get!(instance, '/api/v1/calendar', {
        params: { start: startDate, end: endDate, includeArtist: true },
        timeout: 10000,
    });

    return (Array.isArray(response.data) ? response.data : []).map((item: Record<string, unknown>) => {
        const artist = item.artist as Record<string, unknown> | undefined;
        return {
            id: item.id as number,
            artistId: item.artistId as number,
            artistName: artist?.artistName as string,
            artist: artist ? {
                artistName: artist.artistName as string,
                overview: artist.overview as string,
                status: artist.status as string | undefined,
                genres: artist.genres as string[] | undefined,
                ratings: artist.ratings as { votes: number; value: number } | undefined,
                foreignArtistId: artist.foreignArtistId as string | undefined,
                images: artist.images as { coverType: string; url?: string; remoteUrl?: string }[],
                statistics: artist.statistics ? {
                    albumCount: (artist.statistics as Record<string, unknown>).albumCount as number | undefined,
                    trackCount: (artist.statistics as Record<string, unknown>).trackCount as number | undefined,
                    trackFileCount: (artist.statistics as Record<string, unknown>).trackFileCount as number | undefined,
                } : undefined,
            } : undefined,
            title: item.title as string,
            releaseDate: item.releaseDate as string,
            overview: item.overview as string,
            hasFile: item.hasFile as boolean | undefined,
            albumType: item.albumType as string | undefined,
            images: item.images as { coverType: string; url?: string; remoteUrl?: string }[] | undefined,
            statistics: item.statistics ? {
                trackCount: (item.statistics as Record<string, unknown>).trackCount as number | undefined,
                trackFileCount: (item.statistics as Record<string, unknown>).trackFileCount as number | undefined,
            } : undefined,
        };
    });
}

// ============================================================================
// MISSING SUBTYPE (aggregated counts for stats bar)
// ============================================================================

/** Missing counts polling interval */
export const missingIntervalMs = 60000; // 1 minute

/** Missing counts shape */
export interface MissingCounts {
    missingCount: number;
    cutoffUnmetCount: number;
}

/**
 * Poll Lidarr for aggregated missing + cutoff-unmet counts.
 * Uses pageSize=1 since we only need the totalRecords count from the response.
 */
export async function pollMissing(instance: PluginInstance, adapter: PluginAdapter): Promise<MissingCounts> {
    // Fetch both counts in parallel — pageSize=1 to minimize data transfer
    const [missingRes, cutoffRes] = await Promise.all([
        adapter.get!(instance, '/api/v1/wanted/missing', {
            params: { pageSize: 1, sortKey: 'releaseDate', sortDirection: 'descending' },
            timeout: 10000,
        }),
        adapter.get!(instance, '/api/v1/wanted/cutoff', {
            params: { pageSize: 1, sortKey: 'releaseDate', sortDirection: 'descending' },
            timeout: 10000,
        }),
    ]);

    return {
        missingCount: missingRes.data?.totalRecords ?? 0,
        cutoffUnmetCount: cutoffRes.data?.totalRecords ?? 0,
    };
}

/**
 * Subtypes configuration for the plugin.
 * Each subtype has its own polling interval and function.
 */
export const subtypes = {
    calendar: {
        intervalMs: calendarIntervalMs,
        poll: pollCalendar,
    },
    missing: {
        intervalMs: missingIntervalMs,
        poll: pollMissing,
    },
};
