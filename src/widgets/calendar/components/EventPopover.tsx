/**
 * EventPopover — Enhanced calendar event popover
 *
 * Displays event details in a popover when clicking an event pill.
 * Used by both MonthGrid and AgendaList views.
 */

import React from 'react';
import { Popover } from '@/shared/ui';
import { Tv, Film } from 'lucide-react';
import { usePopoverState } from '../../../hooks/usePopoverState';
import type { CalendarEvent } from '../calendar.types';

interface EventPopoverProps {
    event: CalendarEvent;
    showInstanceName?: boolean;
    /** Override trigger element (for agenda list). Defaults to event pill. */
    children?: React.ReactNode;
}

/** Get the display title for an event */
function getDisplayTitle(event: CalendarEvent): string {
    return event.type === 'sonarr'
        ? (event.series?.title || event.seriesTitle || 'Unknown Show')
        : (event.title || 'Unknown Movie');
}

/** Get the release/air date for an event */
function getEventDate(event: CalendarEvent): string {
    const raw = event.type === 'sonarr'
        ? event.airDate
        : (event.digitalRelease || event.physicalRelease || event.inCinemas);
    if (!raw) return '';
    return new Date(raw).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
    });
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

    // Default trigger: event pill
    const defaultTrigger = (
        <button
            className={`cal-event-pill ${isTV ? 'cal-event-pill--tv' : 'cal-event-pill--movie'}`}
            title={displayTitle}
        >
            {displayTitle}
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
