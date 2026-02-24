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

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { WidgetStateMessage, PartialErrorBadge, type ErroredInstance } from '../../shared/widgets';
import { useMultiWidgetIntegration } from '../../shared/widgets/hooks/useMultiWidgetIntegration';
import { useMultiIntegrationSSE } from '../../shared/widgets/hooks/useMultiIntegrationSSE';
import { useRoleAwareIntegrations } from '../../api/hooks/useIntegrations';
import logger from '../../utils/logger';
import { toLocalDateStr } from '../../shared/utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { useDashboardEdit } from '../../context/DashboardEditContext';
import { isAdmin } from '../../utils/permissions';
import MonthGrid from './components/MonthGrid';
import AgendaList from './components/AgendaList';
import type { WidgetProps } from '../types';
import type { CalendarEvent, EventsMap, FilterType, ViewMode } from './calendar.types';
import './styles.css';

// ============================================================================
// PREVIEW MODE — Static calendar for widget picker
// ============================================================================

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
                                        <span key={j} className={`cal-event-pill ${ev.type === 'sonarr' ? 'cal-event-pill--tv' : 'cal-event-pill--movie'}`}>
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

interface CalendarConfig {
    sonarrIntegrationIds?: string[];
    radarrIntegrationIds?: string[];
    sonarrIntegrationId?: string;   // Legacy
    radarrIntegrationId?: string;   // Legacy
    viewMode?: ViewMode;
    showPastEvents?: boolean;
}

const CombinedCalendarWidget: React.FC<WidgetProps> = ({ widget, previewMode = false }) => {
    if (previewMode) return <PreviewMode />;

    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // ---- Config ----
    const config = widget.config as CalendarConfig | undefined;
    const viewMode: ViewMode = config?.viewMode ?? 'month';
    const showPastEvents = config?.showPastEvents ?? false;

    // ---- Integration access ----
    const { data: allIntegrations } = useRoleAwareIntegrations();

    const validIntegrationIds = useMemo(() => {
        if (!allIntegrations) return new Set<string>();
        return new Set(allIntegrations.map(i => i.id));
    }, [allIntegrations]);

    const configuredSonarrIds: string[] = useMemo(() => {
        const raw = config?.sonarrIntegrationIds
            ?? (config?.sonarrIntegrationId ? [config.sonarrIntegrationId] : []);
        return validIntegrationIds.size > 0 ? raw.filter(id => validIntegrationIds.has(id)) : raw;
    }, [config?.sonarrIntegrationIds, config?.sonarrIntegrationId, validIntegrationIds]);

    const configuredRadarrIds: string[] = useMemo(() => {
        const raw = config?.radarrIntegrationIds
            ?? (config?.radarrIntegrationId ? [config.radarrIntegrationId] : []);
        return validIntegrationIds.size > 0 ? raw.filter(id => validIntegrationIds.has(id)) : raw;
    }, [config?.radarrIntegrationIds, config?.radarrIntegrationId, validIntegrationIds]);

    const {
        integrations,
        status: accessStatus,
        loading: accessLoading,
    } = useMultiWidgetIntegration('calendar', {
        sonarr: configuredSonarrIds[0],
        radarr: configuredRadarrIds[0],
    }, widget.id);

    const sonarrIds = integrations.sonarr?.isAccessible ? configuredSonarrIds : [];
    const radarrIds = integrations.radarr?.isAccessible ? configuredRadarrIds : [];
    const hasSonarr = integrations.sonarr?.isAccessible ?? false;
    const hasRadarr = integrations.radarr?.isAccessible ?? false;
    const hasAnyIntegration = hasSonarr || hasRadarr;
    const hasMultipleSonarr = sonarrIds.length > 1;
    const hasMultipleRadarr = radarrIds.length > 1;

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

    // ---- Helpers ----
    const buildEventsMap = (sonarrItems: CalendarEvent[], radarrItems: CalendarEvent[]): EventsMap => {
        const newEvents: EventsMap = {};
        // Date boundaries matching the backend poller window (30 past / 60 future)
        const now = Date.now();
        const startBound = toLocalDateStr(new Date(now - 30 * 24 * 60 * 60 * 1000));
        const endBound = toLocalDateStr(new Date(now + 60 * 24 * 60 * 60 * 1000));
        sonarrItems.forEach(item => {
            const date = item.airDate;
            if (date) {
                const dateStr = date.split('T')[0];
                if (!newEvents[dateStr]) newEvents[dateStr] = [];
                newEvents[dateStr].push({ ...item, type: 'sonarr' });
            }
        });
        radarrItems.forEach(item => {
            const date = item.physicalRelease || item.digitalRelease || item.inCinemas;
            if (date) {
                const dateStr = date.split('T')[0];
                // Skip entries whose plotted date falls outside the calendar window
                // (Radarr returns movies if ANY date overlaps the window)
                if (dateStr < startBound || dateStr > endBound) return;
                if (!newEvents[dateStr]) newEvents[dateStr] = [];
                newEvents[dateStr].push({ ...item, type: 'radarr' });
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
        setEvents(buildEventsMap(sonarrItems, radarrItems));
    }, []);

    // ---- SSE Subscriptions ----
    const { loading: sonarrLoading, isConnected: sonarrConnected, erroredInstances: sonarrErroredInstances, allErrored: sonarrAllErrored } = useMultiIntegrationSSE<{ items: CalendarEvent[]; _meta?: unknown }>({
        integrationType: 'sonarr',
        subtype: 'calendar',
        integrationIds: sonarrIds,
        enabled: hasSonarr && sonarrIds.length > 0,
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
        enabled: hasRadarr && radarrIds.length > 0,
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

    // ---- Loading / Error States ----
    const sonarrNotReady = hasSonarr && sonarrIds.length > 0 && (!sonarrConnected || sonarrLoading) && !sonarrAllErrored;
    const radarrNotReady = hasRadarr && radarrIds.length > 0 && (!radarrConnected || radarrLoading) && !radarrAllErrored;
    const hasAnyData = Object.keys(events).length > 0 || sonarrConnected || radarrConnected;
    const loading = (sonarrNotReady || radarrNotReady) && !hasAnyData;

    const allErroredInstances: ErroredInstance[] = useMemo(() => {
        const result: ErroredInstance[] = [];
        sonarrErroredInstances.forEach(id => {
            result.push({ id, name: instanceNameMap[id] || id });
        });
        radarrErroredInstances.forEach(id => {
            result.push({ id, name: instanceNameMap[id] || id });
        });
        return result;
    }, [sonarrErroredInstances, radarrErroredInstances, instanceNameMap]);

    const allIntegrationsErrored =
        ((!hasSonarr || sonarrAllErrored) && (!hasRadarr || radarrAllErrored)) &&
        (hasSonarr || hasRadarr);

    // ---- Navigation ----
    const changeMonth = useCallback((offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    }, []);

    const goToToday = useCallback(() => {
        setCurrentDate(new Date());
    }, []);

    // ---- Early returns (after all hooks) ----
    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (accessStatus === 'noAccess') {
        return <WidgetStateMessage variant="noAccess" serviceName="Calendar" />;
    }

    if (accessStatus === 'disabled') {
        return <WidgetStateMessage variant="disabled" serviceName="Sonarr/Radarr" isAdmin={userIsAdmin} />;
    }

    if (accessStatus === 'notConfigured' || !hasAnyIntegration) {
        return <WidgetStateMessage variant="notConfigured" serviceName="Sonarr/Radarr" isAdmin={userIsAdmin} />;
    }

    if (allIntegrationsErrored && !loading) {
        return (
            <WidgetStateMessage
                variant="unavailable"
                serviceName="Sonarr/Radarr"
                message={allErroredInstances.length === 1
                    ? `Unable to reach ${allErroredInstances[0].name}`
                    : `Unable to reach ${allErroredInstances.length} integrations`}
            />
        );
    }

    const dashboardEditContext = useDashboardEdit();
    const isEditMode = dashboardEditContext?.editMode ?? false;

    // ---- Render ----
    return (
        <>
            {/* Partial error badge */}
            {allErroredInstances.length > 0 && !allIntegrationsErrored && !isEditMode && (
                <PartialErrorBadge
                    erroredInstances={allErroredInstances}
                    className="absolute top-2 right-2 z-40"
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
                                showFilter
                                onFilterChange={setFilter}
                                showPastEvents={showPastEvents}
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
                                showFilter
                                onFilterChange={setFilter}
                            />
                        )}

                        {/* Both mode — 70/30 split (calendar : agenda) */}
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
                                        showFilter
                                        onFilterChange={setFilter}
                                        compact
                                    />
                                </div>
                                <div className="cal-split-agenda">
                                    <AgendaList
                                        events={events}
                                        filter={filter}
                                        hasMultipleSonarr={hasMultipleSonarr}
                                        hasMultipleRadarr={hasMultipleRadarr}
                                        showFilter={false}
                                        compact
                                        showPastEvents={showPastEvents}
                                        scrollToMonth={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`}
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
