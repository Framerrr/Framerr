/**
 * EventPopover — Enhanced calendar event popover
 *
 * Displays event details in a popover when clicking an event pill.
 * Used by both MonthGrid and AgendaList views.
 */

import React from 'react';
import { Popover } from '@/shared/ui';
import { Tv, Film, Disc3 } from 'lucide-react';
import { usePopoverState } from '@/shared/hooks/usePopoverState';
import type { CalendarEvent } from '../calendar.types';
import {
    getEventTypeKey,
    EVENT_TYPE_COLOR,
    EVENT_TYPE_ICON,
    getDisplayTitle,
    getEventDate,
    getEpisodeCode,
    getAlbumMeta,
    getPosterUrl,
    getMovieReleaseTypeLabel,
} from './eventPopoverHelpers';

interface EventPopoverProps {
    event: CalendarEvent;
    showInstanceName?: boolean;
    /** Override trigger element (for agenda list). Defaults to event pill. */
    children?: React.ReactNode;
}

const EventPopover: React.FC<EventPopoverProps> = ({ event, showInstanceName, children }) => {
    const { isOpen, onOpenChange } = usePopoverState();
    const displayTitle = getDisplayTitle(event);
    const episodeCode = getEpisodeCode(event);
    const dateStr = getEventDate(event);
    const posterUrl = getPosterUrl(event);
    const isTV = event.type === 'sonarr';
    const isMusic = event.type === 'lidarr';
    const albumMeta = isMusic ? getAlbumMeta(event) : '';
    const posterClass = `cal-popover-poster${isMusic ? ' cal-popover-poster--square' : ''}`;
    const posterPlaceholderClass = `cal-popover-poster-placeholder${isMusic ? ' cal-popover-poster-placeholder--square' : ''}`;

    const typeKey = getEventTypeKey(event);
    const TypeIcon = EVENT_TYPE_ICON[typeKey];
    const releaseTypeLabel = !isTV && !isMusic ? getMovieReleaseTypeLabel(event) : '';
    const releaseTypeColor = EVENT_TYPE_COLOR[typeKey];
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
                    <div className="cal-popover-header">
                        {posterUrl ? (
                            <img
                                src={posterUrl}
                                alt={displayTitle}
                                className={posterClass}
                                loading="lazy"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        ) : (
                            <div className={posterPlaceholderClass}>
                                {isTV ? <Tv size={16} /> : isMusic ? <Disc3 size={16} /> : <Film size={16} />}
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
                            {isMusic && albumMeta && (
                                <div className="cal-popover-episode cal-popover-artist">
                                    {albumMeta}
                                </div>
                            )}
                            {releaseTypeLabel && (
                                <div
                                    className="cal-popover-release-type"
                                    style={{ color: releaseTypeColor }}
                                >
                                    {releaseTypeLabel}
                                </div>
                            )}
                            <div className="cal-popover-date">{dateStr}</div>
                        </div>
                    </div>

                    {showInstanceName && event.instanceName && (
                        <div className="cal-popover-instance">{event.instanceName}</div>
                    )}

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

export default EventPopover;
