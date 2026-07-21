/**
 * AgendaList — Chronological event list grouped into proximity buckets
 *
 * Future events are grouped into 5 proximity buckets (Today/Tomorrow/This Week/
 * Next Week/Later); past events (within Look Back) keep one-header-per-day
 * layout. Each event shows poster, title, episode code, release-type stripe, and
 * type badge. Clicking an event opens the Sonarr/Radarr detail modal (read-only).
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Tv, Film, Calendar as CalendarIcon } from 'lucide-react';
import { WidgetStateMessage } from '../../../shared/widgets';
import EpisodeDetailModal from '../../sonarr/components/EpisodeDetailModal';
import MovieDetailModal from '../../radarr/components/MovieDetailModal';
import { getDisplayTitle, getEpisodeCode, getPosterUrl } from './EventPopover';
import type { CalendarEvent, EventsMap, FilterType } from '../calendar.types';
import { toLocalDateStr } from '../../../shared/utils/dateUtils';
import { formatDisplayDate } from '../../_shared/media/format';

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
    /** Whether to show a "Today" button for scrolling back (agenda-only mode) */
    showTodayButton?: boolean;
}

/** An event paired with the specific date string it is plotted under in this group. */
interface DatedEvent {
    dateStr: string;
    event: CalendarEvent;
}

type BucketId = 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'later';

const BUCKET_ORDER: BucketId[] = ['today', 'tomorrow', 'thisWeek', 'nextWeek', 'later'];

const BUCKET_LABELS: Record<BucketId, string> = {
    today: 'Today',
    tomorrow: 'Tomorrow',
    thisWeek: 'This Week',
    nextWeek: 'Next Week',
    later: 'Later',
};

/**
 * Proximity bucket for a future date. Returns null for past dates (dayOffset < 0),
 * which are handled by the existing per-day path instead. "This Week"/"Next Week"
 * are rolling 7-day windows from today, not calendar-week (Mon-Sun) boundaries.
 */
function getBucketId(dateStr: string, todayStr: string): BucketId | null {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    const dayOffset = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (dayOffset < 0) return null;
    if (dayOffset === 0) return 'today';
    if (dayOffset === 1) return 'tomorrow';
    if (dayOffset <= 6) return 'thisWeek';
    if (dayOffset <= 13) return 'nextWeek';
    return 'later';
}

/** A single rendered header group — either a past per-day group or a future proximity bucket. */
interface RenderGroup {
    kind: 'day' | 'bucket';
    id: string;
    /** Earliest/representative date. Used as the group container's `data-date` anchor
     * (sufficient for scrollToToday's exact-match lookup and the auto-scroll-on-mount
     * effect, both of which only need one valid anchor at/after todayStr). */
    dateStr: string;
    label: string;
    isToday: boolean;
    /** True for This Week/Next Week/Later — these can span multiple dates, so each
     * card also renders its own inline date + data-date anchor (see rendering below). */
    showInlineDates: boolean;
    /** Only set for This Week/Next Week — "Jul 20–25" or a single date if min===max. */
    dateRangeLabel?: string;
    events: DatedEvent[];
}

// No-op stubs for admin-only actions (hidden via userIsAdmin={false})
const noopAutoSearch = async () => false;
const noopSearchReleases = async () => [] as never[];
const noopGrabRelease = async () => false;

/** Get movie release type label, preferring the specific plotted milestone (set by
 * buildEventsMap) over re-deriving fallback-priority from the raw date fields — keeps
 * the label in sync with the stripe color even under movieDates: 'all'. */
function getMovieReleaseType(ev: CalendarEvent): string {
    switch (ev.plottedReleaseType) {
        case 'physical': return 'Physical Release';
        case 'digital': return 'Digital Release';
        case 'cinema': return 'In Cinemas';
    }
    // Defensive fallback for a radarr event with no plottedReleaseType set.
    if (ev.digitalRelease) return 'Digital Release';
    if (ev.physicalRelease) return 'Physical Release';
    if (ev.inCinemas) return 'In Cinemas';
    return '';
}

/** Left-border stripe color for an agenda card, matching the shared release-type tokens. */
function getStripeColor(ev: CalendarEvent): string {
    if (ev.type === 'sonarr') return 'var(--tv)';
    switch (ev.plottedReleaseType) {
        case 'cinema': return 'var(--cinema)';
        case 'physical': return 'var(--physical)';
        case 'digital':
        default: return 'var(--digital)';
    }
}

/** Format a date string into a friendly label (past dates only — see RenderGroup) */
function formatDateLabel(dateStr: string): { label: string; isToday: boolean } {
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

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

/** Get relative day text for past dates (e.g. "2 days ago") */
function getRelativeDay(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffMs = dateOnly.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === -1) return 'Yesterday';
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

        // For other months, scroll to the first date group (or per-card anchor, for
        // multi-date buckets) in that month
        const target = container.querySelector(
            `[data-date^="${scrollToMonth}"]`
        ) as HTMLElement | null;
        if (target) {
            const targetTop = target.offsetTop - container.offsetTop;
            container.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
    }, [scrollToMonth]);

    // Build sorted, bucketed, filtered list
    const groups: RenderGroup[] = useMemo(() => {
        const todayStr = toLocalDateStr(new Date());
        const dateKeys = Object.keys(events).sort();

        const pastGroups: RenderGroup[] = [];
        const bucketEvents: Record<BucketId, DatedEvent[]> = {
            today: [], tomorrow: [], thisWeek: [], nextWeek: [], later: [],
        };

        dateKeys.forEach(dateStr => {
            let dayEvents = events[dateStr];
            // Apply filter
            if (filter === 'tv') dayEvents = dayEvents.filter(ev => ev.type === 'sonarr');
            else if (filter === 'movies') dayEvents = dayEvents.filter(ev => ev.type === 'radarr');
            if (dayEvents.length === 0) return;

            const bucketId = getBucketId(dateStr, todayStr);
            if (bucketId === null) {
                // Past date — keep the exact one-header-per-day behavior, unchanged.
                const { label, isToday } = formatDateLabel(dateStr);
                pastGroups.push({
                    kind: 'day',
                    id: dateStr,
                    dateStr,
                    label,
                    isToday,
                    showInlineDates: false,
                    events: dayEvents.map(event => ({ dateStr, event })),
                });
                return;
            }

            dayEvents.forEach(event => bucketEvents[bucketId].push({ dateStr, event }));
        });

        const bucketGroups: RenderGroup[] = BUCKET_ORDER
            .filter(id => bucketEvents[id].length > 0)
            .map(id => {
                const items = bucketEvents[id]; // ascending order (dateKeys sorted ascending)
                const earliestDate = items[0].dateStr;
                const showInlineDates = id === 'thisWeek' || id === 'nextWeek' || id === 'later';

                let dateRangeLabel: string | undefined;
                if (id === 'thisWeek' || id === 'nextWeek') {
                    const uniqueDates = Array.from(new Set(items.map(i => i.dateStr))).sort();
                    const min = uniqueDates[0];
                    const max = uniqueDates[uniqueDates.length - 1];
                    dateRangeLabel = min === max
                        ? formatDisplayDate(min)
                        : `${formatDisplayDate(min)}–${formatDisplayDate(max)}`;
                }

                return {
                    kind: 'bucket' as const,
                    id,
                    dateStr: earliestDate,
                    label: BUCKET_LABELS[id],
                    isToday: id === 'today',
                    showInlineDates,
                    dateRangeLabel,
                    events: items,
                };
            });

        return [...pastGroups, ...bucketGroups];
    }, [events, filter]);

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

    // Auto-scroll to today on initial data load
    const hasData = groups.length > 0;
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
            container.scrollTo({ top: targetTop, behavior: 'instant' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasData]);

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
                    <div key={group.id} className="cal-agenda-group" data-date={group.dateStr}>
                        {/* Date/bucket header */}
                        <div className={`cal-agenda-date ${group.isToday ? 'cal-agenda-date--today' : ''}`}>
                            <span className="cal-agenda-date-label">{group.label}</span>
                            {group.kind === 'day' && !group.isToday && (
                                <span className="cal-agenda-date-rel">{getRelativeDay(group.dateStr)}</span>
                            )}
                            {group.kind === 'bucket' && group.dateRangeLabel && (
                                <span className="cal-agenda-date-range">{group.dateRangeLabel}</span>
                            )}
                        </div>

                        {/* Event cards */}
                        {group.events.map(({ dateStr, event: ev }, idx) => {
                            const isTV = ev.type === 'sonarr';
                            const title = getDisplayTitle(ev);
                            const episodeCode = getEpisodeCode(ev);
                            const posterUrl = getPosterUrl(ev);
                            const releaseType = !isTV ? getMovieReleaseType(ev) : '';
                            const stripeColor = getStripeColor(ev);

                            return (
                                <button
                                    key={idx}
                                    className="cal-agenda-card"
                                    data-date={group.showInlineDates ? dateStr : undefined}
                                    style={{ '--stripe-color': stripeColor } as React.CSSProperties}
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

                                    {/* Inline date — This Week / Next Week / Later buckets only */}
                                    {group.showInlineDates && (
                                        <div className="cal-agenda-card-date">{formatDisplayDate(dateStr)}</div>
                                    )}
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
