/**
 * MonthGrid — Modern calendar month grid view
 *
 * Displays a month grid with day cells and event pills.
 * Events show a popover on click with details.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { WidgetStateMessage } from '../../../shared/widgets';
import EventPopover from './EventPopover';
import type { CalendarEvent, EventsMap, FilterType } from '../calendar.types';
import { toLocalDateStr } from '../../../shared/utils/dateUtils';

interface MonthGridProps {
    events: EventsMap;
    filter: FilterType;
    currentDate: Date;
    onChangeMonth: (offset: number) => void;
    onGoToToday: () => void;
    hasMultipleSonarr: boolean;
    hasMultipleRadarr: boolean;
    hasMultipleLidarr?: boolean;
    /** Bound-source filter chips — hidden when that type has no integrations */
    showTvFilter?: boolean;
    showMoviesFilter?: boolean;
    showMusicFilter?: boolean;
    /** Whether to show the filter row */
    showFilter?: boolean;
    onFilterChange?: (filter: FilterType) => void;
    /** Whether this is inside the "both" split view (adjusts sizing) */
    compact?: boolean;
    /** Start week on Monday instead of Sunday */
    startWeekOnMonday?: boolean;
}

const SUNDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const MonthGrid: React.FC<MonthGridProps> = ({
    events,
    filter,
    currentDate,
    onChangeMonth,
    onGoToToday,
    hasMultipleSonarr,
    hasMultipleRadarr,
    showTvFilter = true,
    showMoviesFilter = true,
    showMusicFilter = true,
    showFilter = true,
    onFilterChange,
    compact = false,
    startWeekOnMonday = false,
}) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = endOfMonth.getDate();
    // Sunday-start: getDay() returns 0=Sunday, 1=Monday, ..., 6=Saturday
    // Monday-start: shift so Monday=0, Tuesday=1, ..., Sunday=6
    const rawStartDay = startOfMonth.getDay();
    const startDay = startWeekOnMonday ? (rawStartDay + 6) % 7 : rawStartDay;
    const todayStr = toLocalDateStr(new Date());
    const dayHeaders = startWeekOnMonday ? MONDAY_HEADERS : SUNDAY_HEADERS;

    /** Filter events by type */
    const filterEvents = (dayEvents: CalendarEvent[]): CalendarEvent[] => {
        if (filter === 'all') return dayEvents;
        if (filter === 'tv') return dayEvents.filter(ev => ev.type === 'sonarr');
        if (filter === 'music') return dayEvents.filter(ev => ev.type === 'lidarr');
        return dayEvents.filter(ev => ev.type === 'radarr');
    };

    const hasEvents = Object.keys(events).length > 0;

    return (
        <div className={`cal-month ${compact ? 'cal-month--compact' : ''}`}>
            {/* Consolidated control row: month nav + Today + filter chips.
                Left/right button groups sit in equal-width (1fr) grid columns so the
                month title is mathematically centered regardless of the groups' actual
                content width (Today makes the right group wider than the left) — see
                styles.css. */}
            <div className="cal-month-header">
                <div className="cal-month-header-side cal-month-header-side--left">
                    <button className="cal-nav-btn" onClick={() => onChangeMonth(-1)} aria-label="Previous month">
                        <ChevronLeft />
                    </button>
                </div>
                <span className="cal-month-title">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <div className="cal-month-header-side cal-month-header-side--right">
                    <button className="cal-today-btn" onClick={onGoToToday}>
                        Today
                    </button>
                    <button className="cal-nav-btn" onClick={() => onChangeMonth(1)} aria-label="Next month">
                        <ChevronRight />
                    </button>
                </div>

                {showFilter && onFilterChange && (showTvFilter || showMoviesFilter || showMusicFilter) && (
                    <div className="cal-filter-group">
                        <button
                            onClick={() => onFilterChange('all')}
                            className={`cal-filter-btn ${filter === 'all' ? 'cal-filter-btn--active' : ''}`}
                        >
                            All
                        </button>
                        {showTvFilter && (
                            <button
                                onClick={() => onFilterChange('tv')}
                                className={`cal-filter-btn cal-filter-btn--tv ${filter === 'tv' ? 'cal-filter-btn--active-tv' : ''}`}
                            >
                                TV
                            </button>
                        )}
                        {showMoviesFilter && (
                            <button
                                onClick={() => onFilterChange('movies')}
                                className={`cal-filter-btn cal-filter-btn--movie ${filter === 'movies' ? 'cal-filter-btn--active-movie' : ''}`}
                            >
                                Movies
                            </button>
                        )}
                        {showMusicFilter && (
                            <button
                                onClick={() => onFilterChange('music')}
                                className={`cal-filter-btn cal-filter-btn--music ${filter === 'music' ? 'cal-filter-btn--active-music' : ''}`}
                            >
                                Music
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Grid */}
            <div className="cal-grid">
                {/* Day headers */}
                {dayHeaders.map((d, i) => (
                    <div key={i} className="cal-grid-day-header">{d}</div>
                ))}

                {/* Empty cells before month starts */}
                {Array.from({ length: startDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="cal-grid-empty" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = toLocalDateStr(new Date(year, month, day));
                    const dayEvents = events[dateStr] || [];
                    const filtered = filterEvents(dayEvents);
                    const isToday = dateStr === todayStr;

                    return (
                        <div
                            key={day}
                            className={`cal-grid-cell ${isToday ? 'cal-grid-cell--today' : ''} ${filtered.length > 0 ? 'cal-grid-cell--has-events' : ''}`}
                        >
                            <div className="cal-grid-day-num">
                                {isToday ? <span className="cal-grid-day-num-circle">{day}</span> : day}
                            </div>
                            <div className="cal-grid-events">
                                {filtered.map((ev, idx) => (
                                    <EventPopover
                                        key={idx}
                                        event={ev}
                                        showInstanceName={ev.type === 'sonarr' ? hasMultipleSonarr : hasMultipleRadarr}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty state overlay */}
            {!hasEvents && (
                <div className="cal-empty-overlay">
                    <WidgetStateMessage
                        variant="empty"
                        emptyIcon={CalendarIcon}
                        emptyTitle="No Releases This Month"
                        emptySubtitle="Try navigating to a different month"
                    />
                </div>
            )}
        </div>
    );
};

export default MonthGrid;
