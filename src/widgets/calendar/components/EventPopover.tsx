/**
 * EventPopover — Enhanced calendar event popover
 *
 * Displays event details in a popover when clicking an event pill.
 * Used by both MonthGrid and AgendaList views.
 */

import React from 'react';
import { Popover } from '@/shared/ui';
import { Tv, Film, Clapperboard, Smartphone, Disc3 } from 'lucide-react';
import { usePopoverState } from '@/shared/hooks/usePopoverState';
import type { CalendarEvent } from '../calendar.types';

interface EventPopoverProps {
    event: CalendarEvent;
    showInstanceName?: boolean;
    /** Override trigger element (for agenda list). Defaults to event pill. */
    children?: React.ReactNode;
}

/** Which of the 4 shared release-type colors this event should render as. */
export type EventTypeKey = 'tv' | 'cinema' | 'digital' | 'physical';

export function getEventTypeKey(event: CalendarEvent): EventTypeKey {
    if (event.type === 'sonarr') return 'tv';
    // 'digital' fallback matches the historical default used elsewhere in this file
    // for a radarr item with no plottedReleaseType set — defensive only, since every
    // CalendarWidget.tsx-produced radarr CalendarEvent has this field set.
    return event.plottedReleaseType ?? 'digital';
}

export const EVENT_TYPE_COLOR: Record<EventTypeKey, string> = {
    tv: 'var(--tv)',
    cinema: 'var(--cinema)',
    digital: 'var(--digital)',
    physical: 'var(--physical)',
};

/** Lucide icon suffix for the default pill trigger (never emoji). TV pills never
 * show one — too frequent to warrant an icon on every episode. */
export const EVENT_TYPE_ICON: Record<EventTypeKey, React.ComponentType<{ size?: number; className?: string }> | null> = {
    tv: null,
    cinema: Clapperboard,
    digital: Smartphone,
    physical: Disc3,
};

/** Get the display title for an event */
function getDisplayTitle(event: CalendarEvent): string {
    return event.type === 'sonarr'
        ? (event.series?.title || event.seriesTitle || 'Unknown Show')
        : (event.title || 'Unknown Movie');
}

/** Map a plottedReleaseType to its corresponding CalendarEvent date field. */
const RELEASE_TYPE_FIELD: Record<'cinema' | 'digital' | 'physical', 'inCinemas' | 'digitalRelease' | 'physicalRelease'> = {
    cinema: 'inCinemas',
    digital: 'digitalRelease',
    physical: 'physicalRelease',
};

/** Get the release/air date (and time if available) for an event. For radarr
 * events, reads the date field matching this specific plotted instance
 * (event.plottedReleaseType) rather than re-deriving via the fallback chain —
 * under movieDates: 'all' a single movie can plot as up to 3 separate events
 * (cinema/digital/physical), each anchored to a different calendar date, and
 * the popover must show the date matching the pill the user actually clicked. */
function getEventDate(event: CalendarEvent): string {
    const raw = event.type === 'sonarr'
        ? (event.airDateUtc || event.airDate)
        : (event.plottedReleaseType
            ? event[RELEASE_TYPE_FIELD[event.plottedReleaseType]]
            : (event.digitalRelease || event.physicalRelease || event.inCinemas));
    if (!raw) return '';
    const d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00');
    const datePart = d.toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
    });
    // Show air time only for TV shows with a real timestamp (not date-only)
    if (event.type === 'sonarr' && raw.includes('T')) {
        const timePart = d.toLocaleTimeString(undefined, {
            hour: 'numeric', minute: '2-digit',
        });
        return `${datePart} · ${timePart}`;
    }
    return datePart;
}

/** Build poster proxy URL if available */
function getPosterUrl(event: CalendarEvent, size: 'sm' | 'md' = 'sm'): string | null {
    const images = event.type === 'sonarr'
        ? event.series?.images
        : event.images;
    if (!images?.length) return null;
    const poster = images.find(img => img.coverType === 'poster');
    const url = poster?.remoteUrl || poster?.url;
    if (!url || !event.instanceId) return null;
    return `/api/integrations/${event.instanceId}/proxy/image?url=${encodeURIComponent(url)}`;
}

/** Format episode code like S02E05 */
function getEpisodeCode(event: CalendarEvent): string {
    if (event.seasonNumber == null || event.episodeNumber == null) return '';
    return `S${String(event.seasonNumber).padStart(2, '0')}E${String(event.episodeNumber).padStart(2, '0')}`;
}

const EventPopover: React.FC<EventPopoverProps> = ({ event, showInstanceName, children }) => {
    const { isOpen, onOpenChange } = usePopoverState();
    const displayTitle = getDisplayTitle(event);
    const episodeCode = getEpisodeCode(event);
    const dateStr = getEventDate(event);
    const posterUrl = getPosterUrl(event);
    const isTV = event.type === 'sonarr';

    // Default trigger: event pill, colored by release type via a CSS custom property
    // rather than one modifier class per type, with a Lucide icon suffix (never emoji).
    const typeKey = getEventTypeKey(event);
    const TypeIcon = EVENT_TYPE_ICON[typeKey];
    const defaultTrigger = (
        <button
            className="cal-event-pill"
            style={{ '--pill-color': EVENT_TYPE_COLOR[typeKey] } as React.CSSProperties}
            title={displayTitle}
        >
            {TypeIcon && <TypeIcon size={9} className="cal-event-pill-icon" />}
            <span className="cal-event-pill-text">{displayTitle}</span>
        </button>
    );

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>
                {children || defaultTrigger}
            </Popover.Trigger>

            <Popover.Content
                side="bottom"
                align="start"
                sideOffset={4}
                className="cal-popover"
            >
                <div className="cal-popover-inner">
                    {/* Poster thumbnail + info */}
                    <div className="cal-popover-header">
                        {posterUrl ? (
                            <img
                                src={posterUrl}
                                alt={displayTitle}
                                className="cal-popover-poster"
                                loading="lazy"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        ) : (
                            <div className="cal-popover-poster-placeholder">
                                {isTV ? <Tv size={16} /> : <Film size={16} />}
                            </div>
                        )}
                        <div className="cal-popover-info">
                            <div className="cal-popover-title">{displayTitle}</div>
                            {isTV && episodeCode && (
                                <div className="cal-popover-episode">
                                    {episodeCode}
                                    {event.title && ` · ${event.title}`}
                                </div>
                            )}
                            <div className="cal-popover-date">{dateStr}</div>
                        </div>
                    </div>

                    {/* Instance badge */}
                    {showInstanceName && event.instanceName && (
                        <div className="cal-popover-instance">{event.instanceName}</div>
                    )}

                    {/* Overview */}
                    {event.overview && (
                        <div className="cal-popover-overview custom-scrollbar">
                            {event.overview}
                        </div>
                    )}
                </div>
            </Popover.Content>
        </Popover>
    );
};

export { getDisplayTitle, getEventDate, getEpisodeCode, getPosterUrl };
export default EventPopover;
