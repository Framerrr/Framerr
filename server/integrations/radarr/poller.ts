import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';

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
}

/**
 * Poll Radarr queue for a specific instance.
 * Returns the current download queue with progress information.
 */
export async function poll(instance: PluginInstance): Promise<RadarrQueueItem[]> {
    if (!instance.config.url || !instance.config.apiKey) {
        return [];
    }

    const url = (instance.config.url as string).replace(/\/$/, '');
    const apiKey = instance.config.apiKey as string;

    const response = await axios.get(`${url}/api/v3/queue`, {
        params: { includeMovie: true, pageSize: 500 },
        headers: { 'X-Api-Key': apiKey },
        httpsAgent,
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
    }));
}

// ============================================================================
// CALENDAR SUBTYPE
// ============================================================================

/** Calendar polling interval (longer than queue since calendar changes less frequently) */
export const calendarIntervalMs = 60000; // 1 minute

/** Calendar movie shape */
export interface CalendarMovie {
    id: number;
    title: string;
    overview?: string;
    inCinemas?: string;
    digitalRelease?: string;
    physicalRelease?: string;
    year?: number;
    tmdbId?: number;
}

/**
 * Poll Radarr calendar for a specific instance.
 * Returns movies for 60-day window (30 days past, 30 days future).
 */
export async function pollCalendar(instance: PluginInstance): Promise<CalendarMovie[]> {
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
        params: { start: startDate, end: endDate, unmonitored: false },
        headers: { 'X-Api-Key': apiKey },
        httpsAgent,
        timeout: 10000,
    });

    return (Array.isArray(response.data) ? response.data : []).map((item: Record<string, unknown>) => ({
        id: item.id as number,
        title: item.title as string,
        overview: item.overview as string,
        inCinemas: item.inCinemas as string,
        digitalRelease: item.digitalRelease as string,
        physicalRelease: item.physicalRelease as string,
        year: item.year as number,
        tmdbId: item.tmdbId as number,
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
