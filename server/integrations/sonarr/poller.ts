import { PluginInstance, PluginAdapter } from '../types';

// ============================================================================
// SONARR POLLER
// ============================================================================

/** Polling interval in milliseconds */
export const intervalMs = 5000;

/** Queue item shape for Sonarr */
export interface SonarrQueueItem {
    id: number;
    seriesId?: number;
    episodeId?: number;
    series?: {
        title?: string;
        tvdbId?: number;
        tmdbId?: number;
    };
    episode?: {
        seasonNumber?: number;
        episodeNumber?: number;
        title?: string;
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
 * Poll Sonarr queue for a specific instance.
 * Returns the current download queue with progress information.
 */
export async function poll(instance: PluginInstance, adapter: PluginAdapter): Promise<SonarrQueueItem[]> {
    const response = await adapter.get!(instance, '/api/v3/queue', {
        params: { includeSeries: true, includeEpisode: true, pageSize: 500 },
        timeout: 10000,
    });

    return (response.data.records || []).map((item: Record<string, unknown>) => ({
        id: item.id,
        seriesId: item.seriesId,
        episodeId: item.episodeId,
        series: (item.series as Record<string, unknown>)
            ? {
                title: (item.series as Record<string, unknown>).title,
                tvdbId: (item.series as Record<string, unknown>).tvdbId,
                tmdbId: (item.series as Record<string, unknown>).tmdbId,
            }
            : null,
        episode: (item.episode as Record<string, unknown>)
            ? {
                seasonNumber: (item.episode as Record<string, unknown>).seasonNumber,
                episodeNumber: (item.episode as Record<string, unknown>).episodeNumber,
                title: (item.episode as Record<string, unknown>).title,
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

/** Calendar episode shape */
export interface CalendarEpisode {
    id: number;
    seriesId: number;
    seriesTitle?: string;
    series?: {
        title?: string;
        overview?: string;
        year?: number;
        status?: string;
        network?: string;
        genres?: string[];
        ratings?: { votes: number; value: number };
        tvdbId?: number;
        imdbId?: string;
        images?: { coverType: string; url?: string; remoteUrl?: string }[];
    };
    title?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    airDate?: string;
    airDateUtc?: string;
    overview?: string;
    hasFile?: boolean;
}

/**
 * Poll Sonarr calendar for a specific instance.
 * Returns episodes for 90-day window (30 days past, 60 days future).
 */
export async function pollCalendar(instance: PluginInstance, adapter: PluginAdapter): Promise<CalendarEpisode[]> {
    // Calendar window: 30 days past → 60 days future
    const now = Date.now();
    const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await adapter.get!(instance, '/api/v3/calendar', {
        params: { start: startDate, end: endDate, includeSeries: true },
        timeout: 10000,
    });

    return (Array.isArray(response.data) ? response.data : []).map((item: Record<string, unknown>) => {
        const series = item.series as Record<string, unknown> | undefined;
        return {
            id: item.id as number,
            seriesId: item.seriesId as number,
            seriesTitle: series?.title as string,
            series: series ? {
                title: series.title as string,
                overview: series.overview as string,
                year: series.year as number | undefined,
                status: series.status as string | undefined,
                network: series.network as string | undefined,
                genres: series.genres as string[] | undefined,
                ratings: series.ratings as { votes: number; value: number } | undefined,
                tvdbId: series.tvdbId as number | undefined,
                imdbId: series.imdbId as string | undefined,
                images: series.images as { coverType: string; url?: string; remoteUrl?: string }[],
            } : undefined,
            title: item.title as string,
            seasonNumber: item.seasonNumber as number,
            episodeNumber: item.episodeNumber as number,
            airDate: item.airDate as string,
            airDateUtc: item.airDateUtc as string,
            overview: item.overview as string,
            hasFile: item.hasFile as boolean | undefined,
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
 * Poll Sonarr for aggregated missing + cutoff-unmet counts.
 * Uses pageSize=1 since we only need the totalRecords count from the response.
 */
export async function pollMissing(instance: PluginInstance, adapter: PluginAdapter): Promise<MissingCounts> {
    // Fetch both counts in parallel — pageSize=1 to minimize data transfer
    const [missingRes, cutoffRes] = await Promise.all([
        adapter.get!(instance, '/api/v3/wanted/missing', {
            params: { pageSize: 1, sortKey: 'airDateUtc', sortDirection: 'descending' },
            timeout: 10000,
        }),
        adapter.get!(instance, '/api/v3/wanted/cutoff', {
            params: { pageSize: 1, sortKey: 'airDateUtc', sortDirection: 'descending' },
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
