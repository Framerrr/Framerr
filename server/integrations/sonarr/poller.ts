import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';

// ============================================================================
// SONARR POLLER
// ============================================================================

/** Polling interval in milliseconds */
export const intervalMs = 5000;

/** Queue item shape for Sonarr */
export interface SonarrQueueItem {
    id: number;
    seriesId?: number;
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
}

/**
 * Poll Sonarr queue for a specific instance.
 * Returns the current download queue with progress information.
 */
export async function poll(instance: PluginInstance): Promise<SonarrQueueItem[]> {
    if (!instance.config.url || !instance.config.apiKey) {
        return [];
    }

    const url = (instance.config.url as string).replace(/\/$/, '');
    const apiKey = instance.config.apiKey as string;

    const response = await axios.get(`${url}/api/v3/queue`, {
        params: { includeSeries: true, includeEpisode: true, pageSize: 500 },
        headers: { 'X-Api-Key': apiKey },
        httpsAgent,
        timeout: 10000,
    });

    return (response.data.records || []).map((item: Record<string, unknown>) => ({
        id: item.id,
        seriesId: item.seriesId,
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
    };
    title?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    airDate?: string;
    airDateUtc?: string;
    overview?: string;
}

/**
 * Poll Sonarr calendar for a specific instance.
 * Returns episodes for 60-day window (30 days past, 30 days future).
 */
export async function pollCalendar(instance: PluginInstance): Promise<CalendarEpisode[]> {
    if (!instance.config.url || !instance.config.apiKey) {
        return [];
    }

    const url = (instance.config.url as string).replace(/\/$/, '');
    const apiKey = instance.config.apiKey as string;

    // Get 60 days of calendar data (30 days past, 30 days future)
    const now = Date.now();
    const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await axios.get(`${url}/api/v3/calendar`, {
        params: { start: startDate, end: endDate, includeSeries: true },
        headers: { 'X-Api-Key': apiKey },
        httpsAgent,
        timeout: 10000,
    });

    return (Array.isArray(response.data) ? response.data : []).map((item: Record<string, unknown>) => ({
        id: item.id as number,
        seriesId: item.seriesId as number,
        seriesTitle: (item.series as Record<string, unknown>)?.title as string,
        series: item.series ? {
            title: (item.series as Record<string, unknown>).title as string,
            overview: (item.series as Record<string, unknown>).overview as string,
        } : undefined,
        title: item.title as string,
        seasonNumber: item.seasonNumber as number,
        episodeNumber: item.episodeNumber as number,
        airDate: item.airDate as string,
        airDateUtc: item.airDateUtc as string,
        overview: item.overview as string,
    }));
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
};
