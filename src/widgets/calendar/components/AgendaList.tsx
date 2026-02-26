/**
 * AgendaList — Chronological event list grouped by date
 *
 * Displays upcoming events in a scrollable list, grouped under date headers.
 * Each event shows poster, title, episode code, and type badge.
 * Clicking an event opens the Sonarr/Radarr detail modal (read-only).
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Tv, Film, Calendar as CalendarIcon } from 'lucide-react';
import { WidgetStateMessage } from '../../../shared/widgets';
import EpisodeDetailModal from '../../sonarr/components/EpisodeDetailModal';
import MovieDetailModal from '../../radarr/components/MovieDetailModal';
import { getDisplayTitle, getEpisodeCode, getPosterUrl } from './EventPopover';
import type { CalendarEvent, EventsMap, FilterType } from '../calendar.types';
import { toLocalDateStr } from '../../../shared/utils/dateUtils';

/** Get localized air time string from a UTC timestamp */
function getAirTime(event: CalendarEvent): string | null {
    const raw = event.type === 'sonarr'
        ? (event.airDateUtc || event.airDate)
        : (event.digitalRelease || event.physicalRelease || event.inCinemas);
    if (!raw || !raw.includes('T')) return null;
    return new Date(raw).toLocaleTimeString(undefined, {
        hour: 'numeric', minute: '2-digit',
    });
}

interface AgendaListProps {
    events: EventsMap;
    filter: FilterType;
    hasMultipleSonarr: boolean;
    hasMultipleRadarr: boolean;
    /** Whether to show the filter row */
    showFilter?: boolean;
    onFilterChange?: (filter: FilterType) => void;
    /** Whether this is inside the "both" split view */
    compact?: boolean;
    /** When set, scroll to the first date group matching this month (YYYY-MM format) */
    scrollToMonth?: string;
    /** Whether to show events before today (default: false) */
    showPastEvents?: boolean;
    /** Whether to show a "Today" button for scrolling back (agenda-only mode) */
    showTodayButton?: boolean;
}

interface DateGroup {
    dateStr: string;
    label: string;
    isToday: boolean;
    events: CalendarEvent[];
}

// No-op stubs for admin-only actions (hidden via userIsAdmin={false})
const noopAutoSearch = async () => false;
const noopSearchReleases = async () => [] as never[];
const noopGrabRelease = async () => false;

/** Get movie release type label from which date field is populated */
function getMovieReleaseType(ev: CalendarEvent): string {
    if (ev.digitalRelease) return 'Digital Release';
    if (ev.physicalRelease) return 'Physical Release';
    if (ev.inCinemas) return 'In Cinemas';
    return '';
}

/** Format a date string into a friendly label */
function formatDateLabel(dateStr: string): { label: string; isToday: boolean } {
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (dateOnly.getTime() === today.getTime()) {
        return { label: 'Today', isToday: true };
    }
    if (dateOnly.getTime() === tomorrow.getTime()) {
        return { label: 'Tomorrow', isToday: false };
    }
    if (dateOnly.getTime() === yesterday.getTime()) {
        return { label: 'Yesterday', isToday: false };
    }

    return {
        label: date.toLocaleDateString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric',
        }),
        isToday: false,
    };
}

/** Get relative day text (e.g. "in 3 days", "2 days ago") */
function getRelativeDay(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffMs = dateOnly.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1) return `in ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
}

const AgendaList: React.FC<AgendaListProps> = ({
    events,
    filter,
    hasMultipleSonarr,
    hasMultipleRadarr,
    showFilter = true,
    onFilterChange,
    compact = false,
    scrollToMonth,
    showPastEvents = false,
    showTodayButton = false,
}) => {
    // Modal state
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleCardClick = useCallback((ev: CalendarEvent) => {
        setSelectedEvent(ev);
        setModalOpen(true);
    }, []);

    // Scroll to month when scrollToMonth changes
    useEffect(() => {
        if (!scrollToMonth || !scrollRef.current) return;
        const container = scrollRef.current;

        // If target month is the current month, scroll to today (or next future item)
        const todayStr = toLocalDateStr(new Date());
        const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM
        if (scrollToMonth === currentMonthStr) {
            // Find today's group or the next future group
            const todayTarget = container.querySelector(
                `[data-date="${todayStr}"]`
            ) as HTMLElement | null
                ?? Array.from(container.querySelectorAll('[data-date]'))
                    .find(el => (el as HTMLElement).dataset.date! >= todayStr) as HTMLElement | null;
            if (todayTarget) {
                const targetTop = todayTarget.offsetTop - container.offsetTop;
                container.scrollTo({ top: targetTop, behavior: 'smooth' });
                return;
            }
        }

        // For other months, scroll to the first date group in that month
        const target = container.querySelector(
            `[data-date^="${scrollToMonth}"]`
        ) as HTMLElement | null;
        if (target) {
            const targetTop = target.offsetTop - container.offsetTop;
            container.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
    }, [scrollToMonth]);

    // Build sorted, grouped, filtered list
    const groups: DateGroup[] = useMemo(() => {
        const todayStr = toLocalDateStr(new Date());
        const dateKeys = Object.keys(events).sort();
        return dateKeys
            .map(dateStr => {
                // Hide past events if toggle is off
                if (!showPastEvents && dateStr < todayStr) return null;

                let dayEvents = events[dateStr];
                // Apply filter
                if (filter === 'tv') dayEvents = dayEvents.filter(ev => ev.type === 'sonarr');
                else if (filter === 'movies') dayEvents = dayEvents.filter(ev => ev.type === 'radarr');
                if (dayEvents.length === 0) return null;

                const { label, isToday } = formatDateLabel(dateStr);
                return { dateStr, label, isToday, events: dayEvents };
            })
            .filter((g): g is DateGroup => g !== null);
    }, [events, filter, showPastEvents]);

    const hasEvents = groups.length > 0;

    // Scroll to today (or next future item)
    const scrollToToday = useCallback(() => {
        if (!scrollRef.current || groups.length === 0) return;
        const todayStr = toLocalDateStr(new Date());
        // Find today's group or the next future group
        const targetGroup = groups.find(g => g.dateStr >= todayStr);
        if (!targetGroup) return;
        const target = scrollRef.current.querySelector(
            `[data-date="${targetGroup.dateStr}"]`
        ) as HTMLElement | null;
        if (target) {
            const container = scrollRef.current;
            const targetTop = target.offsetTop - container.offsetTop;
            container.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
    }, [groups]);

    // Auto-scroll to today on initial data load AND when showPastEvents toggles off (snap back)
    const hasData = groups.length > 0;
    const prevShowPast = useRef(showPastEvents);
    useEffect(() => {
        if (!scrollRef.current || !hasData) return;
        const todayStr = toLocalDateStr(new Date());
        const targetGroup = groups.find(g => g.dateStr >= todayStr);
        if (!targetGroup) return;
        const target = scrollRef.current.querySelector(
            `[data-date="${targetGroup.dateStr}"]`
        ) as HTMLElement | null;
        if (target) {
            const container = scrollRef.current;
            const targetTop = target.offsetTop - container.offsetTop;
            // Instant on mount, smooth when toggling past events off
            const behavior = prevShowPast.current !== showPastEvents ? 'smooth' : 'instant';
            container.scrollTo({ top: targetTop, behavior });
        }
        prevShowPast.current = showPastEvents;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasData, showPastEvents]);

    return (
        <div className={`cal-agenda ${compact ? 'cal-agenda--compact' : ''}`}>
            {/* Filter row */}
            {showFilter && onFilterChange && (
                <div className="cal-filter-row">
                    <button
                        onClick={() => onFilterChange('all')}
                        className={`cal-filter-btn ${filter === 'all' ? 'cal-filter-btn--active' : ''}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => onFilterChange('tv')}
                        className={`cal-filter-btn cal-filter-btn--tv ${filter === 'tv' ? 'cal-filter-btn--active-tv' : ''}`}
                    >
                        TV
                    </button>
                    <button
                        onClick={() => onFilterChange('movies')}
                        className={`cal-filter-btn cal-filter-btn--movie ${filter === 'movies' ? 'cal-filter-btn--active-movie' : ''}`}
                    >
                        Movies
                    </button>
                    {showTodayButton && (
                        <button className="cal-agenda-today-btn" onClick={scrollToToday}>
                            Today
                        </button>
                    )}
                </div>
            )}

            {/* Scrollable list */}
            <div ref={scrollRef} className="cal-agenda-scroll custom-scrollbar">
                {groups.map(group => (
                    <div key={group.dateStr} className="cal-agenda-group" data-date={group.dateStr}>
                        {/* Date header */}
                        <div className={`cal-agenda-date ${group.isToday ? 'cal-agenda-date--today' : ''}`}>
                            <span className="cal-agenda-date-label">{group.label}</span>
                            {!group.isToday && (
                                <span className="cal-agenda-date-rel">{getRelativeDay(group.dateStr)}</span>
                            )}
                        </div>

                        {/* Event cards */}
                        {group.events.map((ev, idx) => {
                            const isTV = ev.type === 'sonarr';
                            const title = getDisplayTitle(ev);
                            const episodeCode = getEpisodeCode(ev);
                            const posterUrl = getPosterUrl(ev);
                            const releaseType = !isTV ? getMovieReleaseType(ev) : '';

                            return (
                                <button
                                    key={idx}
                                    className="cal-agenda-card"
                                    onClick={() => handleCardClick(ev)}
                                >
                                    {/* Poster thumbnail */}
                                    <div className="cal-agenda-poster">
                                        {posterUrl ? (
                                            <img src={posterUrl} alt={title} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        ) : (
                                            <div className="cal-agenda-poster-placeholder">
                                                {isTV ? <Tv size={18} /> : <Film size={18} />}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="cal-agenda-card-info">
                                        <div className="cal-agenda-card-title">{title}</div>
                                        {isTV && episodeCode && (
                                            <div className="cal-agenda-card-meta">{episodeCode}{ev.title ? ` · ${ev.title}` : ''}</div>
                                        )}
                                        {!isTV && releaseType && (
                                            <div className="cal-agenda-card-meta">{releaseType}</div>
                                        )}
                                        {isTV && (() => {
                                            const airTime = getAirTime(ev);
                                            return airTime ? (
                                                <div className="cal-agenda-card-meta text-theme-tertiary" style={{ fontSize: '0.7rem' }}>
                                                    Airs: {airTime}
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>

                                    {/* Type badge — top right */}
                                    <div className={`cal-agenda-type-badge ${isTV ? 'cal-agenda-type-badge--tv' : 'cal-agenda-type-badge--movie'}`}>
                                        {isTV ? 'TV' : 'Movie'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Empty state */}
            {!hasEvents && (
                <WidgetStateMessage
                    variant="empty"
                    emptyIcon={CalendarIcon}
                    emptyTitle="No Upcoming Events"
                    emptySubtitle="Your calendar is clear"
                />
            )}

            {/* Sonarr Episode Detail Modal */}
            {selectedEvent?.type === 'sonarr' && (
                <EpisodeDetailModal
                    episode={selectedEvent as never}
                    integrationId={selectedEvent.instanceId || ''}
                    open={modalOpen}
                    onOpenChange={setModalOpen}
                    triggerAutoSearch={noopAutoSearch}
                    searchReleases={noopSearchReleases}
                    grabRelease={noopGrabRelease}
                    userIsAdmin={false}
                />
            )}

            {/* Radarr Movie Detail Modal */}
            {selectedEvent?.type === 'radarr' && (
                <MovieDetailModal
                    movie={selectedEvent as never}
                    integrationId={selectedEvent.instanceId || ''}
                    open={modalOpen}
                    onOpenChange={setModalOpen}
                    triggerAutoSearch={noopAutoSearch}
                    searchReleases={noopSearchReleases}
                    grabRelease={noopGrabRelease}
                    userIsAdmin={false}
                />
            )}
        </div>
    );
};

export default AgendaList;
