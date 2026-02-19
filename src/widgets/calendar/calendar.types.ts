/**
 * Calendar Widget Types
 *
 * Shared types used by CalendarWidget, MonthGrid, AgendaList, and EventPopover.
 */

export type EventType = 'sonarr' | 'radarr';
export type FilterType = 'all' | 'tv' | 'movies';
export type ViewMode = 'agenda' | 'month' | 'both';

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
    physicalRelease?: string;
    digitalRelease?: string;
    inCinemas?: string;
    overview?: string;
    instanceId?: string;
    instanceName?: string;
}

export interface EventsMap {
    [dateKey: string]: CalendarEvent[];
}
