/**
 * Calendar Widget
 *
 * Combined Sonarr and Radarr calendar with three view modes:
 * - month: Traditional month grid
 * - agenda: Chronological upcoming list
 * - both: Side-by-side agenda + month
 *
 * View mode is configured via widget settings (not in-widget toggle).
 * Fully read-only for all users.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { WidgetStateMessage, PartialErrorBadge, type ErroredInstance } from '../../shared/widgets';
import { useMultiWidgetIntegration } from '../../shared/widgets/hooks/useMultiWidgetIntegration';
import { useMultiIntegrationSSE } from '../../shared/widgets/hooks/useMultiIntegrationSSE';
import useRealtimeSSE from '@/features/realtime/useRealtimeSSE';
import api from '../../api/client';
import { useRoleAwareIntegrations } from '../../api/hooks/useIntegrations';
import logger from '../../utils/logger';
import { toLocalDateStr } from '../../shared/utils/dateUtils';
import { useAuth } from '../../context/useAuth';
import { useDashboardEdit } from '../../context/useDashboardEdit';
import { isAdmin } from '../../utils/permissions';
import MonthGrid from './components/MonthGrid';
import AgendaList from './components/AgendaList';
import type { WidgetProps } from '../types';
import type { CalendarEvent, EventsMap, FilterType, MovieDatesMode, ViewMode } from './calendar.types';
import './styles.css';

// ============================================================================
// PREVIEW MODE — Static calendar for widget picker
// ============================================================================

/** Mock preview data has no cinema/physical/all-mode concept — one representative color per mock type is sufficient. */
const PREVIEW_PILL_COLOR: Record<'sonarr' | 'radarr', string> = {
    sonarr: 'var(--sonarr)',
    radarr: 'var(--radarr)',
};

function PreviewMode(): React.JSX.Element {
    const mockEvents: Record<number, { title: string; type: 'sonarr' | 'radarr' }[]> = {
        5: [{ title: 'The Bear', type: 'sonarr' }],
        12: [{ title: 'Dune 2', type: 'radarr' }],
        18: [{ title: 'Severance', type: 'sonarr' }, { title: 'White Lotus', type: 'sonarr' }],
        24: [{ title: 'Deadpool 4', type: 'radarr' }],
    };

    return (
        <div className="cal-widget">
            <div className="cal-month">
                <div className="cal-month-header">
                    <span className="cal-month-title">January 2025</span>
                </div>
                <div className="cal-grid">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="cal-grid-day-header">{d}</div>
                    ))}
                    {Array.from({ length: 31 }).map((_, i) => {
                        const day = i + 1;
                        const dayEvents = mockEvents[day] || [];
                        return (
                            <div key={day} className={`cal-grid-cell ${day === 15 ? 'cal-grid-cell--today' : ''}`}>
                                <div className="cal-grid-day-num">{day}</div>
                                <div className="cal-grid-events">
                                    {dayEvents.map((ev, j) => (
                                        <span
                                            key={j}
                                            className="cal-event-pill"
                                            style={{ '--pill-color': PREVIEW_PILL_COLOR[ev.type] } as React.CSSProperties}
                                        >
                                            {ev.title}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN WIDGET
// ============================================================================

/** Keep in sync with Sonarr/Radarr pollCalendar feed window. */
const FEED_PAST_DAYS = 365;
const FEED_FUTURE_DAYS = 730;
const MS_DAY = 24 * 60 * 60 * 1000;

interface CalendarConfig {
    sonarrIntegrationIds?: string[];
    radarrIntegrationIds?: string[];
    lidarrIntegrationIds?: string[];
    sonarrIntegrationId?: string;   // Legacy
    radarrIntegrationId?: string;   // Legacy
    lidarrIntegrationId?: string;   // Legacy
    viewMode?: ViewMode;
    startWeekOnMonday?: boolean | string;
    movieDates?: MovieDatesMode;
    lookAheadDays?: string;
    lookBackDays?: string;
}

function parseDayBound(raw: string | undefined, defaultVal: number | 'all'): number | 'all' {
    if (raw === 'all') return 'all';
    if (raw == null || raw === '') return defaultVal;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : defaultVal;
}

/**
 * Resolve a Calendar integration slot.
 * - Plural key present (including []): authoritative; empty ⇒ explicit none (`null` for the hook)
 * - Else legacy singular ID
 * - Else never configured (`undefined` ⇒ hook may auto-fallback)
 */
function resolveIntegrationSlot(
    plural: string[] | undefined,
    singular: string | undefined,
    validIds: Set<string>,
): { ids: string[]; hookValue: string | null | undefined } {
    if (Array.isArray(plural)) {
        const ids = validIds.size > 0 ? plural.filter((id) => validIds.has(id)) : plural;
        return { ids, hookValue: ids[0] ?? null };
    }
    if (singular) {
        const ids = validIds.size === 0 || validIds.has(singular) ? [singular] : [];
        return { ids, hookValue: ids[0] ?? null };
    }
    return { ids: [], hookValue: undefined };
}

function filterEventsByLookWindow(
    map: EventsMap,
    lookBack: number | 'all',
    lookAhead: number | 'all',
): EventsMap {
    const todayStr = toLocalDateStr(new Date());
    const todayMs = new Date(`${todayStr}T00:00:00`).getTime();
    const pastDays = lookBack === 'all' ? FEED_PAST_DAYS : lookBack;
    const futureDays = lookAhead === 'all' ? FEED_FUTURE_DAYS : lookAhead;
    const startStr = toLocalDateStr(new Date(todayMs - pastDays * MS_DAY));
    const endStr = toLocalDateStr(new Date(todayMs + futureDays * MS_DAY));

    const out: EventsMap = {};
    for (const [dateStr, list] of Object.entries(map)) {
        if (dateStr < startStr || dateStr > endStr) continue;
        out[dateStr] = list;
    }
    return out;
}

const CombinedCalendarWidget: React.FC<WidgetProps> = ({ widget, previewMode = false }) => {
    if (previewMode) {
        return <PreviewMode />;
    }

    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // ---- Config ----
    const config = widget.config as CalendarConfig | undefined;
    const viewMode: ViewMode = config?.viewMode ?? 'month';
    const startWeekOnMonday = config?.startWeekOnMonday === true || config?.startWeekOnMonday === 'true';
    const movieDates: MovieDatesMode = config?.movieDates ?? 'all';
    const lookAheadDays = parseDayBound(config?.lookAheadDays, 60);
    const lookBackDays = parseDayBound(config?.lookBackDays, 30);

    // ---- Integration access ----
    const { data: allIntegrations } = useRoleAwareIntegrations();

    const validIntegrationIds = useMemo(() => {
        if (!allIntegrations) return new Set<string>();
        return new Set(allIntegrations.map(i => i.id));
    }, [allIntegrations]);

    const sonarrSlot = useMemo(
        () => resolveIntegrationSlot(config?.sonarrIntegrationIds, config?.sonarrIntegrationId, validIntegrationIds),
        [config?.sonarrIntegrationIds, config?.sonarrIntegrationId, validIntegrationIds],
    );
    const radarrSlot = useMemo(
        () => resolveIntegrationSlot(config?.radarrIntegrationIds, config?.radarrIntegrationId, validIntegrationIds),
        [config?.radarrIntegrationIds, config?.radarrIntegrationId, validIntegrationIds],
    );
    const lidarrSlot = useMemo(
        () => resolveIntegrationSlot(config?.lidarrIntegrationIds, config?.lidarrIntegrationId, validIntegrationIds),
        [config?.lidarrIntegrationIds, config?.lidarrIntegrationId, validIntegrationIds],
    );

    const configuredSonarrIds = sonarrSlot.ids;
    const configuredRadarrIds = radarrSlot.ids;
    const configuredLidarrIds = lidarrSlot.ids;

    const {
        integrations,
        status: accessStatus,
        loading: accessLoading,
    } = useMultiWidgetIntegration('calendar', {
        sonarr: sonarrSlot.hookValue,
        radarr: radarrSlot.hookValue,
        lidarr: lidarrSlot.hookValue,
    }, previewMode ? undefined : widget.id);

    const sonarrIds = integrations.sonarr?.isAccessible ? configuredSonarrIds : [];
    const radarrIds = integrations.radarr?.isAccessible ? configuredRadarrIds : [];
    const lidarrIds = integrations.lidarr?.isAccessible ? configuredLidarrIds : [];
    const hasSonarr = integrations.sonarr?.isAccessible ?? false;
    const hasRadarr = integrations.radarr?.isAccessible ?? false;
    const hasLidarr = integrations.lidarr?.isAccessible ?? false;
    const hasAnyIntegration = hasSonarr || hasRadarr || hasLidarr;
    const hasMultipleSonarr = sonarrIds.length > 1;
    const hasMultipleRadarr = radarrIds.length > 1;
    const hasMultipleLidarr = lidarrIds.length > 1;

    const instanceNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        if (allIntegrations) {
            allIntegrations.forEach(int => {
                map[int.id] = int.displayName || int.name;
            });
        }
        return map;
    }, [allIntegrations]);

    // ---- State ----
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [events, setEvents] = useState<EventsMap>({});
    const [filter, setFilter] = useState<FilterType>('all');

    const sonarrDataMapRef = useRef<Map<string, CalendarEvent[]>>(new Map());
    const radarrDataMapRef = useRef<Map<string, CalendarEvent[]>>(new Map());
    const lidarrDataMapRef = useRef<Map<string, CalendarEvent[]>>(new Map());

    // ---- Helpers ----

    /**
     * Resolve which raw date(s) a movie should be plotted under, given the movieDates
     * config. Under 'all', a movie can produce up to 3 entries — including 2 sharing
     * the same calendar date (e.g. digitalRelease === physicalRelease). That collision
     * is intentional, not deduped: 'all' mode's purpose is to surface every real
     * milestone, and two milestones landing on one day are two distinct true facts.
     */
    function getMovieDateEntries(
        item: CalendarEvent,
        mode: MovieDatesMode
    ): Array<{ raw: string; releaseType: 'cinema' | 'digital' | 'physical' }> {
        if (mode === 'all') {
            const entries: Array<{ raw: string; releaseType: 'cinema' | 'digital' | 'physical' }> = [];
            if (item.inCinemas) entries.push({ raw: item.inCinemas, releaseType: 'cinema' });
            if (item.digitalRelease) entries.push({ raw: item.digitalRelease, releaseType: 'digital' });
            if (item.physicalRelease) entries.push({ raw: item.physicalRelease, releaseType: 'physical' });
            return entries;
        }
        if (mode === 'cinema') {
            return item.inCinemas ? [{ raw: item.inCinemas, releaseType: 'cinema' }] : [];
        }
        if (mode === 'physical') {
            return item.physicalRelease ? [{ raw: item.physicalRelease, releaseType: 'physical' }] : [];
        }
        // mode === 'digital' — digitalRelease only (same strictness as cinema/physical).
        // Movies with no digital date are omitted; use 'all' to plot every milestone.
        return item.digitalRelease
            ? [{ raw: item.digitalRelease, releaseType: 'digital' }]
            : [];
    }

    const buildEventsMap = (sonarrItems: CalendarEvent[], radarrItems: CalendarEvent[], lidarrItems: CalendarEvent[], movieDatesMode: MovieDatesMode): EventsMap => {
        const newEvents: EventsMap = {};
        // Accept anything inside the shared poller feed window; widget look
        // ahead/back knobs filter afterward.
        const now = Date.now();
        const startBound = toLocalDateStr(new Date(now - FEED_PAST_DAYS * MS_DAY));
        const endBound = toLocalDateStr(new Date(now + FEED_FUTURE_DAYS * MS_DAY));
        sonarrItems.forEach(item => {
            // Prefer airDateUtc (real UTC timestamp) for timezone-correct local grouping.
            // Fall back to airDate (date-only string) if airDateUtc is missing.
            const raw = item.airDateUtc || item.airDate;
            if (raw) {
                // Date-only strings (no 'T') are parsed as UTC midnight by JS,
                // which can shift the day. Append T00:00:00 to treat as local instead.
                const dateStr = raw.includes('T')
                    ? toLocalDateStr(new Date(raw))
                    : raw; // airDate is already YYYY-MM-DD, use as-is
                if (dateStr < startBound || dateStr > endBound) return;
                if (!newEvents[dateStr]) newEvents[dateStr] = [];
                newEvents[dateStr].push({ ...item, type: 'sonarr' });
            }
        });
        radarrItems.forEach(item => {
            for (const entry of getMovieDateEntries(item, movieDatesMode)) {
                const dateStr = entry.raw.includes('T')
                    ? toLocalDateStr(new Date(entry.raw))
                    : entry.raw;
                // Skip entries whose plotted date falls outside the feed window
                // (Radarr returns movies if ANY date overlaps the window)
                if (dateStr < startBound || dateStr > endBound) continue;
                if (!newEvents[dateStr]) newEvents[dateStr] = [];
                newEvents[dateStr].push({ ...item, type: 'radarr', plottedReleaseType: entry.releaseType });
            }
        });
        lidarrItems.forEach(item => {
            const raw = item.releaseDate;
            if (raw) {
                const dateStr = raw.includes('T')
                    ? toLocalDateStr(new Date(raw))
                    : raw;
                if (dateStr < startBound || dateStr > endBound) return;
                if (!newEvents[dateStr]) newEvents[dateStr] = [];
                newEvents[dateStr].push({
                    ...item,
                    type: 'lidarr',
                    artistName: item.artist?.artistName || item.artistName,
                    albumTitle: item.title,
                });
            }
        });
        return newEvents;
    };

    const flattenDataMap = (map: Map<string, CalendarEvent[]>): CalendarEvent[] => {
        const result: CalendarEvent[] = [];
        map.forEach(items => result.push(...items));
        return result;
    };

    const rebuildEvents = useCallback(() => {
        const sonarrItems = flattenDataMap(sonarrDataMapRef.current);
        const radarrItems = flattenDataMap(radarrDataMapRef.current);
        const lidarrItems = flattenDataMap(lidarrDataMapRef.current);
        const mapped = buildEventsMap(sonarrItems, radarrItems, lidarrItems, movieDates);
        setEvents(filterEventsByLookWindow(mapped, lookBackDays, lookAheadDays));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [movieDates, lookAheadDays, lookBackDays]);

    // Drop cached SSE payloads for unbound instances immediately (don't wait for refresh).
    const pruneDataMap = useCallback((
        mapRef: { current: Map<string, CalendarEvent[]> },
        allowedIds: string[],
    ): boolean => {
        const allowed = new Set(allowedIds);
        let changed = false;
        for (const id of [...mapRef.current.keys()]) {
            if (!allowed.has(id)) {
                mapRef.current.delete(id);
                changed = true;
            }
        }
        return changed;
    }, []);

    const sonarrIdsKey = useMemo(() => JSON.stringify([...sonarrIds].sort()), [sonarrIds]);
    const radarrIdsKey = useMemo(() => JSON.stringify([...radarrIds].sort()), [radarrIds]);
    const lidarrIdsKey = useMemo(() => JSON.stringify([...lidarrIds].sort()), [lidarrIds]);

    useEffect(() => {
        const sonarrChanged = pruneDataMap(sonarrDataMapRef, sonarrIds);
        const radarrChanged = pruneDataMap(radarrDataMapRef, radarrIds);
        const lidarrChanged = pruneDataMap(lidarrDataMapRef, lidarrIds);
        if (sonarrChanged || radarrChanged || lidarrChanged) {
            rebuildEvents();
        }
        // Reset filter if its source type was unbound
        setFilter((prev) => {
            if (prev === 'tv' && sonarrIds.length === 0) return 'all';
            if (prev === 'movies' && radarrIds.length === 0) return 'all';
            if (prev === 'music' && lidarrIds.length === 0) return 'all';
            return prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keys capture id-list identity
    }, [sonarrIdsKey, radarrIdsKey, lidarrIdsKey, pruneDataMap, rebuildEvents]);

    // Re-plot immediately when movieDates config changes, instead of waiting for the
    // next SSE push (rebuildEvents' identity changes whenever movieDates changes).
    useEffect(() => {
        rebuildEvents();
    }, [rebuildEvents]);

    const showTvFilter = sonarrIds.length > 0;
    const showMoviesFilter = radarrIds.length > 0;
    const showMusicFilter = lidarrIds.length > 0;

    // ---- SSE Subscriptions ----
    const { loading: sonarrLoading, isConnected: sonarrConnected, erroredInstances: sonarrErroredInstances, allErrored: sonarrAllErrored } = useMultiIntegrationSSE<{ items: CalendarEvent[]; _meta?: unknown }>({
        integrationType: 'sonarr',
        subtype: 'calendar',
        integrationIds: sonarrIds,
        enabled: !previewMode && hasSonarr && sonarrIds.length > 0,
        onData: (instanceId, data) => {
            const items = data?.items;
            const taggedItems = (Array.isArray(items) ? items : []).map(item => ({
                ...item,
                instanceId,
                instanceName: instanceNameMap[instanceId] || instanceId,
            }));
            sonarrDataMapRef.current.set(instanceId, taggedItems);
            rebuildEvents();
        },
        onError: (instanceId, err) => {
            logger.debug(`[CalendarWidget] Sonarr SSE error for ${instanceId}:`, err.message);
        }
    });

    const { loading: radarrLoading, isConnected: radarrConnected, erroredInstances: radarrErroredInstances, allErrored: radarrAllErrored } = useMultiIntegrationSSE<{ items: CalendarEvent[]; _meta?: unknown }>({
        integrationType: 'radarr',
        subtype: 'calendar',
        integrationIds: radarrIds,
        enabled: !previewMode && hasRadarr && radarrIds.length > 0,
        onData: (instanceId, data) => {
            const items = data?.items;
            const taggedItems = (Array.isArray(items) ? items : []).map(item => ({
                ...item,
                instanceId,
                instanceName: instanceNameMap[instanceId] || instanceId,
            }));
            radarrDataMapRef.current.set(instanceId, taggedItems);
            rebuildEvents();
        },
        onError: (instanceId, err) => {
            logger.debug(`[CalendarWidget] Radarr SSE error for ${instanceId}:`, err.message);
        }
    });

    const { loading: lidarrLoading, isConnected: lidarrConnected, erroredInstances: lidarrErroredInstances, allErrored: lidarrAllErrored } = useMultiIntegrationSSE<{ items: CalendarEvent[]; _meta?: unknown }>({
        integrationType: 'lidarr',
        subtype: 'calendar',
        integrationIds: lidarrIds,
        enabled: !previewMode && hasLidarr && lidarrIds.length > 0,
        onData: (instanceId, data) => {
            const items = data?.items;
            const taggedItems = (Array.isArray(items) ? items : []).map(item => ({
                ...item,
                instanceId,
                instanceName: instanceNameMap[instanceId] || instanceId,
            }));
            lidarrDataMapRef.current.set(instanceId, taggedItems);
            rebuildEvents();
        },
        onError: (instanceId, err) => {
            logger.debug(`[CalendarWidget] Lidarr SSE error for ${instanceId}:`, err.message);
        }
    });

    // ---- Loading / Error States ----
    const sonarrNotReady = hasSonarr && sonarrIds.length > 0 && (!sonarrConnected || sonarrLoading) && !sonarrAllErrored;
    const radarrNotReady = hasRadarr && radarrIds.length > 0 && (!radarrConnected || radarrLoading) && !radarrAllErrored;
    const lidarrNotReady = hasLidarr && lidarrIds.length > 0 && (!lidarrConnected || lidarrLoading) && !lidarrAllErrored;
    const hasAnyData = Object.keys(events).length > 0 || sonarrConnected || radarrConnected || lidarrConnected;
    const loading = (sonarrNotReady || radarrNotReady || lidarrNotReady) && !hasAnyData;

    const allErroredInstances: ErroredInstance[] = useMemo(() => {
        const result: ErroredInstance[] = [];
        sonarrErroredInstances.forEach(id => {
            result.push({ id, name: instanceNameMap[id] || id });
        });
        radarrErroredInstances.forEach(id => {
            result.push({ id, name: instanceNameMap[id] || id });
        });
        lidarrErroredInstances.forEach(id => {
            result.push({ id, name: instanceNameMap[id] || id });
        });
        return result;
    }, [sonarrErroredInstances, radarrErroredInstances, lidarrErroredInstances, instanceNameMap]);

    const allIntegrationsErrored =
        ((!hasSonarr || sonarrAllErrored) && (!hasRadarr || radarrAllErrored) && (!hasLidarr || lidarrAllErrored)) &&
        (hasSonarr || hasRadarr || hasLidarr);

    const { connectionId } = useRealtimeSSE();

    const handleRetry = useCallback(async () => {
        if (!connectionId) return;
        const topics: string[] = [
            ...sonarrErroredInstances.map(id => `sonarr:calendar:${id}`),
            ...radarrErroredInstances.map(id => `radarr:calendar:${id}`),
            ...lidarrErroredInstances.map(id => `lidarr:calendar:${id}`),
        ];
        await Promise.allSettled(
            topics.map(topic =>
                api.post('/api/realtime/retry', { connectionId, topic }).catch((err: unknown) => {
                    logger.debug('[Calendar] Retry failed for topic', { topic, error: err });
                })
            )
        );
    }, [connectionId, sonarrErroredInstances, radarrErroredInstances, lidarrErroredInstances]);

    // ---- Navigation ----
    const changeMonth = useCallback((offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    }, []);

    /** Bumped on every Today press so Both-mode agenda re-scrolls even if the month is unchanged. */
    const [agendaTodayNonce, setAgendaTodayNonce] = useState(0);

    const goToToday = useCallback(() => {
        setCurrentDate(new Date());
        setAgendaTodayNonce((n) => n + 1);
    }, []);

    const dashboardEditContext = useDashboardEdit();
    const isEditMode = dashboardEditContext?.editMode ?? false;

    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (accessStatus === 'noAccess') {
        return <WidgetStateMessage variant="noAccess" serviceName="Calendar" />;
    }

    if (accessStatus === 'disabled') {
        return <WidgetStateMessage variant="disabled" serviceName="Sonarr/Radarr/Lidarr" isAdmin={userIsAdmin} />;
    }

    if (accessStatus === 'notConfigured' || !hasAnyIntegration) {
        return <WidgetStateMessage variant="notConfigured" serviceName="Sonarr/Radarr/Lidarr" isAdmin={userIsAdmin} />;
    }

    if (allIntegrationsErrored && !loading) {
        return (
            <WidgetStateMessage
                variant="unavailable"
                serviceName="Sonarr/Radarr/Lidarr"
                message={allErroredInstances.length === 1
                    ? `Unable to reach ${allErroredInstances[0].name}`
                    : `Unable to reach ${allErroredInstances.length} integrations`}
                onRetry={handleRetry}
            />
        );
    }

    // ---- Render ----
    return (
        <>
            {/* Partial error badge */}
            {allErroredInstances.length > 0 && !allIntegrationsErrored && !isEditMode && (
                <PartialErrorBadge
                    erroredInstances={allErroredInstances}
                    className="absolute top-2 right-2 z-40"
                    onRetry={handleRetry}
                />
            )}
            <div className="cal-widget">
                {loading ? (
                    <div className="cal-loading">Loading calendar…</div>
                ) : (
                    <>
                        {/* Standalone Agenda view */}
                        {viewMode === 'agenda' && (
                            <AgendaList
                                events={events}
                                filter={filter}
                                hasMultipleSonarr={hasMultipleSonarr}
                                hasMultipleRadarr={hasMultipleRadarr}
                                hasMultipleLidarr={hasMultipleLidarr}
                                showTvFilter={showTvFilter}
                                showMoviesFilter={showMoviesFilter}
                                showMusicFilter={showMusicFilter}
                                showFilter
                                onFilterChange={setFilter}
                                showTodayButton
                            />
                        )}

                        {/* Standalone Month view */}
                        {viewMode === 'month' && (
                            <MonthGrid
                                events={events}
                                filter={filter}
                                currentDate={currentDate}
                                onChangeMonth={changeMonth}
                                onGoToToday={goToToday}
                                hasMultipleSonarr={hasMultipleSonarr}
                                hasMultipleRadarr={hasMultipleRadarr}
                                hasMultipleLidarr={hasMultipleLidarr}
                                showTvFilter={showTvFilter}
                                showMoviesFilter={showMoviesFilter}
                                showMusicFilter={showMusicFilter}
                                showFilter
                                onFilterChange={setFilter}
                                startWeekOnMonday={startWeekOnMonday}
                            />
                        )}

                        {/* Both mode — 60/40 split (calendar : agenda) */}
                        {viewMode === 'both' && (
                            <div className="cal-split">
                                <div className="cal-split-calendar">
                                    <MonthGrid
                                        events={events}
                                        filter={filter}
                                        currentDate={currentDate}
                                        onChangeMonth={changeMonth}
                                        onGoToToday={goToToday}
                                        hasMultipleSonarr={hasMultipleSonarr}
                                        hasMultipleRadarr={hasMultipleRadarr}
                                        hasMultipleLidarr={hasMultipleLidarr}
                                        showTvFilter={showTvFilter}
                                        showMoviesFilter={showMoviesFilter}
                                        showMusicFilter={showMusicFilter}
                                        showFilter
                                        onFilterChange={setFilter}
                                        compact
                                        startWeekOnMonday={startWeekOnMonday}
                                    />
                                </div>
                                <div className="cal-split-agenda">
                                    <AgendaList
                                        events={events}
                                        filter={filter}
                                        hasMultipleSonarr={hasMultipleSonarr}
                                        hasMultipleRadarr={hasMultipleRadarr}
                                        hasMultipleLidarr={hasMultipleLidarr}
                                        showTvFilter={showTvFilter}
                                        showMoviesFilter={showMoviesFilter}
                                        showMusicFilter={showMusicFilter}
                                        showFilter={false}
                                        compact
                                        scrollToMonth={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`}
                                        scrollToTodayNonce={agendaTodayNonce}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
};

export default CombinedCalendarWidget;
