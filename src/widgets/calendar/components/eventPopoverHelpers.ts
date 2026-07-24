import React from 'react';
import { Clapperboard, Smartphone, Disc3, Music, Tv } from 'lucide-react';
import type { CalendarEvent } from '../calendar.types';

/** Which of the shared release-type colors this event should render as. */
export type EventTypeKey = 'tv' | 'cinema' | 'digital' | 'physical' | 'music';

export function getEventTypeKey(event: CalendarEvent): EventTypeKey {
    if (event.type === 'sonarr') return 'tv';
    if (event.type === 'lidarr') return 'music';
    return event.plottedReleaseType ?? 'digital';
}

export const EVENT_TYPE_COLOR: Record<EventTypeKey, string> = {
    tv: 'var(--sonarr)',
    cinema: 'var(--cinema)',
    digital: 'var(--digital)',
    physical: 'var(--physical)',
    music: 'var(--lidarr)',
};

/** Radarr-modal-aligned labels for release milestones (movies only). */
export const MOVIE_RELEASE_TYPE_LABEL: Record<'cinema' | 'digital' | 'physical', string> = {
    cinema: 'In Cinemas',
    digital: 'Digital Release',
    physical: 'Physical Release',
};

/** Movie release-type label, preferring plottedReleaseType (keeps label in sync with color). */
export function getMovieReleaseTypeLabel(event: CalendarEvent): string {
    if (event.type !== 'radarr') return '';
    if (event.plottedReleaseType) return MOVIE_RELEASE_TYPE_LABEL[event.plottedReleaseType];
    if (event.digitalRelease) return MOVIE_RELEASE_TYPE_LABEL.digital;
    if (event.physicalRelease) return MOVIE_RELEASE_TYPE_LABEL.physical;
    if (event.inCinemas) return MOVIE_RELEASE_TYPE_LABEL.cinema;
    return '';
}

/** Lucide icon suffix for the default pill trigger (never emoji). */
export const EVENT_TYPE_ICON: Record<EventTypeKey, React.ComponentType<{ size?: number; className?: string }> | null> = {
    tv: Tv,
    cinema: Clapperboard,
    digital: Smartphone,
    physical: Disc3,
    music: Music,
};

/** Get the display title for an event (month grid pills + primary popover/agenda line). */
export function getDisplayTitle(event: CalendarEvent): string {
    if (event.type === 'sonarr') {
        return event.series?.title || event.seriesTitle || 'Unknown Show';
    }
    if (event.type === 'lidarr') {
        return event.albumTitle || event.title || 'Unknown Album';
    }
    return event.title || 'Unknown Movie';
}

/** Artist name for lidarr secondary lines (popover / agenda). */
export function getArtistDisplayName(event: CalendarEvent): string {
    if (event.type !== 'lidarr') return '';
    return event.artist?.artistName || event.artistName || '';
}

/** Map a plottedReleaseType to its corresponding CalendarEvent date field. */
const RELEASE_TYPE_FIELD: Record<'cinema' | 'digital' | 'physical', 'inCinemas' | 'digitalRelease' | 'physicalRelease'> = {
    cinema: 'inCinemas',
    digital: 'digitalRelease',
    physical: 'physicalRelease',
};

/** Get the release/air date (and time if available) for an event. */
export function getEventDate(event: CalendarEvent): string {
    const raw = event.type === 'sonarr'
        ? (event.airDateUtc || event.airDate)
        : event.type === 'lidarr'
            ? event.releaseDate
            : (event.plottedReleaseType
                ? event[RELEASE_TYPE_FIELD[event.plottedReleaseType]]
                : (event.digitalRelease || event.physicalRelease || event.inCinemas));
    if (!raw) return '';
    const d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00');
    const datePart = d.toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
    });
    if (event.type === 'sonarr' && raw.includes('T')) {
        const timePart = d.toLocaleTimeString(undefined, {
            hour: 'numeric', minute: '2-digit',
        });
        return `${datePart} · ${timePart}`;
    }
    return datePart;
}

/** Build poster proxy URL if available */
export function getPosterUrl(event: CalendarEvent): string | null {
    const images = event.type === 'sonarr'
        ? event.series?.images
        : event.type === 'lidarr'
            ? (event.images?.length ? event.images : event.artist?.images)
            : event.images;
    if (!images?.length) return null;
    const poster = images.find(img => img.coverType === 'cover')
        || images.find(img => img.coverType === 'poster')
        || images[0];
    const url = poster?.remoteUrl || poster?.url;
    if (!url || !event.instanceId) return null;
    return `/api/integrations/${event.instanceId}/proxy/image?url=${encodeURIComponent(url)}`;
}

/** Format episode code like S02E05 */
export function getEpisodeCode(event: CalendarEvent): string {
    if (event.seasonNumber == null || event.episodeNumber == null) return '';
    return `S${String(event.seasonNumber).padStart(2, '0')}E${String(event.episodeNumber).padStart(2, '0')}`;
}

/** Secondary meta for lidarr calendar events: artist · album type */
export function getAlbumMeta(event: CalendarEvent): string {
    if (event.type !== 'lidarr') return '';
    const parts: string[] = [];
    const artist = getArtistDisplayName(event);
    if (artist) parts.push(artist);
    if (event.albumType) parts.push(event.albumType);
    return parts.filter(Boolean).join(' · ');
}
