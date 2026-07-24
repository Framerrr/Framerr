/**
 * Calendar Widget Types
 *
 * Shared types used by CalendarWidget, MonthGrid, AgendaList, and EventPopover.
 */

export type EventType = 'sonarr' | 'radarr' | 'lidarr';
export type FilterType = 'all' | 'tv' | 'movies' | 'music';
export type ViewMode = 'agenda' | 'month' | 'both';

/** Which movie release date field(s) to plot events under. See plugin.ts for config wiring. */
export type MovieDatesMode = 'cinema' | 'digital' | 'physical' | 'all';

export interface CalendarEvent {
    type: EventType;
    title?: string;
    seriesTitle?: string;
    series?: {
        title?: string;
        images?: Array<{
            coverType: string;
            remoteUrl?: string;
            url?: string;
        }>;
    };
    images?: Array<{
        coverType: string;
        remoteUrl?: string;
        url?: string;
    }>;
    seasonNumber?: number;
    episodeNumber?: number;
    airDate?: string;
    airDateUtc?: string;
    physicalRelease?: string;
    digitalRelease?: string;
    inCinemas?: string;
    overview?: string;
    instanceId?: string;
    instanceName?: string;
    runtime?: number;
    /** For lidarr events — nested artist from calendar poller */
    artist?: {
        artistName?: string;
        images?: Array<{
            coverType: string;
            remoteUrl?: string;
            url?: string;
        }>;
    };
    artistName?: string;
    albumTitle?: string;
    releaseDate?: string;
    albumType?: string;
    /** For radarr events only. Identifies which specific release milestone THIS plotted
     * instance represents. Required because under movieDates: 'all' the same source movie
     * is spread into up to 3 independent CalendarEvent objects (one per populated date
     * field) — normally landing in 3 different date buckets, but NOT ALWAYS: two release
     * fields can share the same calendar date (e.g. digitalRelease === physicalRelease),
     * in which case 2 of the 3 objects intentionally land in the SAME date bucket as
     * separate, independently-colored entries (not deduped — see CalendarWidget.tsx's
     * getMovieDateEntries()). This field lets the rendering layer read the correct
     * color/type directly instead of re-deriving fallback-priority logic at every render
     * site. */
    plottedReleaseType?: 'cinema' | 'digital' | 'physical';
}

export interface EventsMap {
    [dateKey: string]: CalendarEvent[];
}
