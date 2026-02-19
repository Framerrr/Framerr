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

interface MonthGridProps {
    events: EventsMap;
    filter: FilterType;
    currentDate: Date;
    onChangeMonth: (offset: number) => void;
    onGoToToday: () => void;
    hasMultipleSonarr: boolean;
    hasMultipleRadarr: boolean;
    /** Whether to show the filter row */
    showFilter?: boolean;
    onFilterChange?: (filter: FilterType) => void;
    /** Whether this is inside the "both" split view (adjusts sizing) */
    compact?: boolean;
}

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MonthGrid: React.FC<MonthGridProps> = ({
    events,
    filter,
    currentDate,
    onChangeMonth,
    onGoToToday,
    hasMultipleSonarr,
    hasMultipleRadarr,
    showFilter = true,
    onFilterChange,
    compact = false,
}) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = endOfMonth.getDate();
    const startDay = startOfMonth.getDay(); // 0 = Sunday
    const todayStr = new Date().toISOString().split('T')[0];

    /** Filter events by type */
    const filterEvents = (dayEvents: CalendarEvent[]): CalendarEvent[] => {
        if (filter === 'all') return dayEvents;
        if (filter === 'tv') return dayEvents.filter(ev => ev.type === 'sonarr');
        return dayEvents.filter(ev => ev.type === 'radarr');
    };

    const hasEvents = Object.keys(events).length > 0;

    return (
        <div className={`cal-month ${compact ? 'cal-month--compact' : ''}`}>
            {/* Header: month nav */}
            <div className="cal-month-header">
                <button className="cal-nav-btn" onClick={() => onChangeMonth(-1)} aria-label="Previous month">
                    <ChevronLeft />
                </button>
                <span className="cal-month-title">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button className="cal-today-btn" onClick={onGoToToday}>
                    Today
                </button>
                <button className="cal-nav-btn" onClick={() => onChangeMonth(1)} aria-label="Next month">
                    <ChevronRight />
                </button>
            </div>

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
                </div>
            )}

            {/* Grid */}
            <div className="cal-grid">
                {/* Day headers */}
                {DAY_HEADERS.map((d, i) => (
                    <div key={i} className="cal-grid-day-header">{d}</div>
                ))}

                {/* Empty cells before month starts */}
                {Array.from({ length: startDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="cal-grid-empty" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
                    const dayEvents = events[dateStr] || [];
                    const filtered = filterEvents(dayEvents);
                    const isToday = dateStr === todayStr;

                    return (
                        <div
                            key={day}
                            className={`cal-grid-cell ${isToday ? 'cal-grid-cell--today' : ''} ${filtered.length > 0 ? 'cal-grid-cell--has-events' : ''}`}
                        >
                            <div className="cal-grid-day-num">{day}</div>
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
