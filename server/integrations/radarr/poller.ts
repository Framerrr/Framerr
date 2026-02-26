import { PluginInstance, PluginAdapter } from '../types';

// ============================================================================
// RADARR POLLER
// ============================================================================

/** Polling interval in milliseconds */
export const intervalMs = 5000;

/** Queue item shape for Radarr */
export interface RadarrQueueItem {
    id: number;
    movieId?: number;
    movie?: {
        title?: string;
        tmdbId?: number;
        year?: number;
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
 * Poll Radarr queue for a specific instance.
 * Returns the current download queue with progress information.
 */
export async function poll(instance: PluginInstance, adapter: PluginAdapter): Promise<RadarrQueueItem[]> {
    const response = await adapter.get!(instance, '/api/v3/queue', {
        params: { includeMovie: true, pageSize: 500 },
        timeout: 10000,
    });

    return (response.data.records || []).map((item: Record<string, unknown>) => ({
        id: item.id,
        movieId: item.movieId,
        movie: (item.movie as Record<string, unknown>)
            ? {
                title: (item.movie as Record<string, unknown>).title,
                tmdbId: (item.movie as Record<string, unknown>).tmdbId,
                year: (item.movie as Record<string, unknown>).year,
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

/** Calendar movie shape — enriched with full metadata for the widget */
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
    images?: { coverType: string; url?: string; remoteUrl?: string }[];
    hasFile?: boolean;
    status?: string; // 'released', 'announced', 'inCinemas'
    runtime?: number;
}

/**
 * Poll Radarr calendar for a specific instance.
 * Returns movies for 90-day window (30 days past, 60 days future).
 */
export async function pollCalendar(instance: PluginInstance, adapter: PluginAdapter): Promise<CalendarMovie[]> {
    // Calendar window: 30 days past → 60 days future
    const now = Date.now();
    const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await adapter.get!(instance, '/api/v3/calendar', {
        params: { start: startDate, end: endDate, unmonitored: false },
        timeout: 10000,
    });

    return (Array.isArray(response.data) ? response.data : []).map((item: Record<string, unknown>) => ({
        id: item.id as number,
        title: item.title as string,
        overview: item.overview as string | undefined,
        inCinemas: item.inCinemas as string | undefined,
        digitalRelease: item.digitalRelease as string | undefined,
        physicalRelease: item.physicalRelease as string | undefined,
        year: item.year as number | undefined,
        tmdbId: item.tmdbId as number | undefined,
        imdbId: item.imdbId as string | undefined,
        studio: item.studio as string | undefined,
        genres: item.genres as string[] | undefined,
        ratings: item.ratings as { votes: number; value: number } | undefined,
        images: item.images as { coverType: string; url?: string; remoteUrl?: string }[] | undefined,
        hasFile: item.hasFile as boolean | undefined,
        status: item.status as string | undefined,
        runtime: item.runtime as number | undefined,
    }));
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
 * Poll Radarr for aggregated missing + cutoff-unmet counts.
 * Uses pageSize=1 since we only need the totalRecords count from the response.
 */
export async function pollMissing(instance: PluginInstance, adapter: PluginAdapter): Promise<MissingCounts> {
    // Fetch both counts in parallel — pageSize=1 to minimize data transfer
    // Radarr uses sortKey=date (not airDateUtc like Sonarr)
    const [missingRes, cutoffRes] = await Promise.all([
        adapter.get!(instance, '/api/v3/wanted/missing', {
            params: { pageSize: 1, sortKey: 'date', sortDirection: 'descending' },
            timeout: 10000,
        }),
        adapter.get!(instance, '/api/v3/wanted/cutoff', {
            params: { pageSize: 1, sortKey: 'date', sortDirection: 'descending' },
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
