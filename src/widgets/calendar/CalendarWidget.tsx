import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Popover } from '@/shared/ui';
import { WidgetStateMessage, useMultiWidgetIntegration, useMultiIntegrationSSE, PartialErrorBadge, type ErroredInstance } from '../../shared/widgets';
import { useIntegrations } from '../../api/hooks/useIntegrations';
import logger from '../../utils/logger';
import { Filter, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDashboardEdit } from '../../context/DashboardEditContext';
import { isAdmin } from '../../utils/permissions';
import { usePopoverState } from '../../hooks/usePopoverState';
import type { WidgetProps } from '../types';
import './styles.css';

type EventType = 'sonarr' | 'radarr';
type FilterType = 'all' | 'tv' | 'movies';

interface CalendarEvent {
    type: EventType;
    title?: string;
    seriesTitle?: string;
    series?: {
        title?: string;
    };
    seasonNumber?: number;
    episodeNumber?: number;
    airDate?: string;
    physicalRelease?: string;
    digitalRelease?: string;
    inCinemas?: string;
    overview?: string;
    instanceId?: string;        // Source integration instance ID
    instanceName?: string;      // Display name for multi-instance mode
}

interface EventsMap {
    [dateKey: string]: CalendarEvent[];
}

interface IntegrationConfig {
    enabled?: boolean;
    url?: string;
    apiKey?: string;
}

// Props for EventPopover
interface EventPopoverProps {
    event: CalendarEvent;
    showInstanceName?: boolean; // Show instance name when multiple of same type
}

interface CalendarWidgetProps extends WidgetProps {
    // No additional props needed
}

// Event Popover Component - PATTERN: usePopoverState (see docs/refactor/PATTERNS.md UI-001)
const EventPopover: React.FC<EventPopoverProps> = ({ event, showInstanceName }) => {
    const { isOpen, onOpenChange } = usePopoverState();

    const displayTitle = event.type === 'sonarr'
        ? (event.series?.title || event.seriesTitle || 'Unknown Show')
        : (event.title || 'Unknown Movie');

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>
                <button
                    className={`
                        text-[9px] px-1 py-[1px] rounded-[2px] whitespace-nowrap overflow-hidden text-ellipsis font-medium cursor-pointer text-white transition-all
                        ${event.type === 'sonarr' ? 'bg-info hover:bg-info/80' : 'bg-success hover:bg-success/80'}
                    `}
                    title={displayTitle}
                >
                    {displayTitle}
                </button>
            </Popover.Trigger>

            <Popover.Content
                side="bottom"
                align="start"
                sideOffset={4}
                className="min-w-[180px] max-w-[200px] relative"
            >
                {/* Instance name badge - positioned top-right */}
                {showInstanceName && event.instanceName && (
                    <div className="absolute top-0 right-0 text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">
                        {event.instanceName}
                    </div>
                )}

                {/* Title */}
                <div className="text-sm font-semibold mb-2 text-theme-primary pr-12">
                    {displayTitle}
                </div>

                {/* Episode info for TV shows */}
                {event.type === 'sonarr' && (
                    <div className="text-xs text-info mb-2 font-medium">
                        Season {event.seasonNumber} Episode {event.episodeNumber}
                        {event.title && ` - ${event.title}`}
                    </div>
                )}

                {/* Release date */}
                <div className="text-xs text-theme-secondary mb-2">
                    {event.type === 'sonarr'
                        ? `Airs: ${new Date(event.airDate || '').toLocaleDateString()}`
                        : `Release: ${new Date(
                            event.physicalRelease ||
                            event.digitalRelease ||
                            event.inCinemas ||
                            ''
                        ).toLocaleDateString()}`
                    }
                </div>

                {/* Overview */}
                {event.overview && (
                    <div className="text-xs text-theme-secondary leading-relaxed max-h-[120px] overflow-auto custom-scrollbar">
                        {event.overview}
                    </div>
                )}
            </Popover.Content>
        </Popover>
    );
};

const CombinedCalendarWidget: React.FC<CalendarWidgetProps> = ({ widget, previewMode = false }) => {
    // Preview mode: render static calendar without hooks
    if (previewMode) {
        const mockEvents: Record<number, { title: string; type: 'sonarr' | 'radarr' }[]> = {
            5: [{ title: 'The Bear S4E1', type: 'sonarr' }],
            12: [{ title: 'Dune 2', type: 'radarr' }],
            18: [{ title: 'Severance', type: 'sonarr' }, { title: 'White Lotus', type: 'sonarr' }],
            24: [{ title: 'Deadpool 4', type: 'radarr' }],
        };
        return (
            <div className="calendar-widget">
                <div className="calendar-widget__header">
                    <span className="calendar-widget__title">January 2025</span>
                </div>
                <div className="calendar-widget__grid">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="calendar-widget__day-header">{d}</div>
                    ))}
                    {Array.from({ length: 31 }).map((_, i) => {
                        const day = i + 1;
                        const dayEvents = mockEvents[day] || [];
                        return (
                            <div key={day} className={`calendar-widget__day-cell ${day === 15 ? 'calendar-widget__day-cell--today' : ''}`}>
                                <div className="calendar-widget__day-number">{day}</div>
                                <div className="calendar-widget__events">
                                    {dayEvents.map((ev, j) => (
                                        <span key={j} className={`text-[9px] px-1 py-[1px] rounded-[2px] text-white ${ev.type === 'sonarr' ? 'bg-info' : 'bg-success'}`}>
                                            {ev.title.split(' ')[0]}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Get auth state to determine admin status
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Get integration IDs from widget config - support both array (new) and singular (legacy)
    const config = widget.config as {
        sonarrIntegrationIds?: string[];
        radarrIntegrationIds?: string[];
        sonarrIntegrationId?: string;  // Legacy
        radarrIntegrationId?: string;  // Legacy
    } | undefined;

    // Get all integrations for name lookup + stale ID filtering
    const { data: allIntegrations } = useIntegrations();

    // Build a set of valid integration IDs for fast lookup
    const validIntegrationIds = useMemo(() => {
        if (!allIntegrations) return new Set<string>();
        return new Set(allIntegrations.map(i => i.id));
    }, [allIntegrations]);

    // Parse IDs with backward compatibility, then filter out deleted/orphaned IDs
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

    // For useMultiWidgetIntegration, we pass the first configured ID for access checking
    const {
        integrations,
        status: accessStatus,
        loading: accessLoading,
        isAdmin: hookIsAdmin,
    } = useMultiWidgetIntegration('calendar', {
        sonarr: configuredSonarrIds[0],
        radarr: configuredRadarrIds[0],
    }, widget.id);

    // Use configured IDs directly for SSE (access check is handled by hook)
    // IDs are already filtered against valid integrations above
    const sonarrIds = integrations.sonarr?.isAccessible ? configuredSonarrIds : [];
    const radarrIds = integrations.radarr?.isAccessible ? configuredRadarrIds : [];

    // Check if any integration is accessible
    const hasSonarr = integrations.sonarr?.isAccessible ?? false;
    const hasRadarr = integrations.radarr?.isAccessible ?? false;
    const hasAnyIntegration = hasSonarr || hasRadarr;

    // Check if we have multiple instances of same type (to show instance names)
    const hasMultipleSonarr = sonarrIds.length > 1;
    const hasMultipleRadarr = radarrIds.length > 1;


    // Build instanceId -> displayName lookup map
    const instanceNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        if (allIntegrations) {
            allIntegrations.forEach(int => {
                map[int.id] = int.displayName || int.name;
            });
        }
        return map;
    }, [allIntegrations]);

    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [events, setEvents] = useState<EventsMap>({});
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');

    // Track raw SSE data per instance, keyed by instanceId
    const sonarrDataMapRef = useRef<Map<string, CalendarEvent[]>>(new Map());
    const radarrDataMapRef = useRef<Map<string, CalendarEvent[]>>(new Map());

    // Calculate month bounds for filtering display
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    // Helper: Transform raw calendar data into EventsMap
    const buildEventsMap = (sonarrItems: CalendarEvent[], radarrItems: CalendarEvent[]): EventsMap => {
        const newEvents: EventsMap = {};

        // Add sonarr events
        sonarrItems.forEach((item) => {
            const date = item.airDate;
            if (date) {
                const dateStr = date.split('T')[0];
                if (!newEvents[dateStr]) newEvents[dateStr] = [];
                newEvents[dateStr].push({ ...item, type: 'sonarr' });
            }
        });

        // Add radarr events
        radarrItems.forEach((item) => {
            const date = item.physicalRelease || item.digitalRelease || item.inCinemas;
            if (date) {
                const dateStr = date.split('T')[0];
                if (!newEvents[dateStr]) newEvents[dateStr] = [];
                newEvents[dateStr].push({ ...item, type: 'radarr' });
            }
        });

        return newEvents;
    };

    // Helper: Flatten Map<string, CalendarEvent[]> into single array
    const flattenDataMap = (map: Map<string, CalendarEvent[]>): CalendarEvent[] => {
        const result: CalendarEvent[] = [];
        map.forEach(items => result.push(...items));
        return result;
    };

    // Rebuild events callback - memoized to prevent infinite loops
    const rebuildEvents = useCallback(() => {
        const sonarrItems = flattenDataMap(sonarrDataMapRef.current);
        const radarrItems = flattenDataMap(radarrDataMapRef.current);
        setEvents(buildEventsMap(sonarrItems, radarrItems));
    }, []);

    // Subscribe to multiple Sonarr instances via SSE
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
            setError(null);
        },
        onError: (instanceId, err) => {
            // Debug level - this is an expected state (service unavailable), UI shows it
            logger.debug(`[CalendarWidget] Sonarr SSE error for ${instanceId}:`, err.message);
        }
    });

    // Subscribe to multiple Radarr instances via SSE
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
            setError(null);
        },
        onError: (instanceId, err) => {
            // Debug level - this is an expected state (service unavailable), UI shows it
            logger.debug(`[CalendarWidget] Radarr SSE error for ${instanceId}:`, err.message);
        }
    });

    // Smart loading: only show loading spinner if we have no data yet
    // Once ANY integration has sent data, show the calendar (even if others are still loading)
    const sonarrNotReady = hasSonarr && sonarrIds.length > 0 && (!sonarrConnected || sonarrLoading) && !sonarrAllErrored;
    const radarrNotReady = hasRadarr && radarrIds.length > 0 && (!radarrConnected || radarrLoading) && !radarrAllErrored;
    const hasAnyData = Object.keys(events).length > 0 || sonarrConnected || radarrConnected;
    const loading = (sonarrNotReady || radarrNotReady) && !hasAnyData;

    // Build combined errored instances list for partial error badge
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

    // Check if ALL integrations are errored (both sonarr and radarr)
    const allIntegrationsErrored =
        ((!hasSonarr || sonarrAllErrored) && (!hasRadarr || radarrAllErrored)) &&
        (hasSonarr || hasRadarr);

    const daysInMonth = endOfMonth.getDate();
    const startDay = startOfMonth.getDay(); // 0 = Sunday

    const changeMonth = (offset: number): void => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    const goToToday = (): void => {
        setCurrentDate(new Date());
    };

    // Filter events based on selected filter
    const getFilteredEvents = (dayEvents: CalendarEvent[]): CalendarEvent[] => {
        if (filter === 'all') return dayEvents;
        if (filter === 'tv') return dayEvents.filter(ev => ev.type === 'sonarr');
        if (filter === 'movies') return dayEvents.filter(ev => ev.type === 'radarr');
        return dayEvents;
    };

    // NOW we can have early returns (after all hooks have been called)

    // Handle access loading state
    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Widget not shared to user
    if (accessStatus === 'noAccess') {
        return (
            <WidgetStateMessage
                variant="noAccess"
                serviceName="Calendar"
            />
        );
    }

    // Widget shared but no integrations available
    if (accessStatus === 'disabled') {
        return (
            <WidgetStateMessage
                variant="disabled"
                serviceName="Sonarr/Radarr"
                isAdmin={userIsAdmin}
            />
        );
    }

    // No integrations configured
    if (accessStatus === 'notConfigured' || !hasAnyIntegration) {
        return (
            <WidgetStateMessage
                variant="notConfigured"
                serviceName="Sonarr/Radarr"
                isAdmin={userIsAdmin}
            />
        );
    }

    // All integrations are errored - show unavailable state
    if (allIntegrationsErrored && !loading) {
        return (
            <WidgetStateMessage
                variant="unavailable"
                serviceName="Sonarr/Radarr"
                message={allErroredInstances.length === 1
                    ? `Unable to reach ${allErroredInstances[0].name}`
                    : `Unable to reach ${allErroredInstances.length} integrations`
                }
            />
        );
    }

    // Get edit mode from dashboard context to hide badge during editing
    const dashboardEditContext = useDashboardEdit();
    const isEditMode = dashboardEditContext?.editMode ?? false;

    return (
        <>
            {/* Partial error badge - show when some integrations are errored but not all */}
            {/* Positioned outside widget content so it renders at Card level, hidden in edit mode */}
            {allErroredInstances.length > 0 && !allIntegrationsErrored && !isEditMode && (
                <PartialErrorBadge
                    erroredInstances={allErroredInstances}
                    className="absolute top-2 right-2 z-40"
                />
            )}
            <div className="calendar-widget">
                {/* Header with month navigation and filter */}
                <div className="calendar-widget__header">
                    <button
                        className="calendar-widget__nav-btn"
                        onClick={() => changeMonth(-1)}
                    >
                        <ChevronLeft />
                    </button>
                    <span className="calendar-widget__title">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        className="calendar-widget__today-btn"
                        onClick={goToToday}
                        title="Go to today"
                    >
                        Today
                    </button>
                    <button
                        className="calendar-widget__nav-btn"
                        onClick={() => changeMonth(1)}
                    >
                        <ChevronRight />
                    </button>
                </div>

                {/* Filter buttons */}
                <div className="calendar-widget__filters">
                    <Filter className="calendar-widget__filter-icon" />
                    <button
                        onClick={() => setFilter('all')}
                        className={`calendar-widget__filter-btn ${filter === 'all'
                            ? 'bg-accent text-white'
                            : 'bg-theme-tertiary text-theme-secondary hover:text-theme-primary'
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('tv')}
                        className={`calendar-widget__filter-btn ${filter === 'tv'
                            ? 'bg-info text-white'
                            : 'bg-info/10 text-info hover:bg-info/20'
                            }`}
                    >
                        TV
                    </button>
                    <button
                        onClick={() => setFilter('movies')}
                        className={`calendar-widget__filter-btn ${filter === 'movies'
                            ? 'bg-success text-white'
                            : 'bg-success/10 text-success hover:bg-success/20'
                            }`}
                    >
                        Movies
                    </button>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="calendar-widget__loading">
                        <div>Loading calendar...</div>
                    </div>
                )}

                {/* Error state */}
                {error && !loading && (
                    <div className="calendar-widget__error">
                        {error}
                    </div>
                )}

                {/* Calendar grid */}
                {!loading && !error && (
                    <div className="calendar-widget__grid">
                        {/* Day headers */}
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <div key={i} className="calendar-widget__day-header">
                                {d}
                            </div>
                        ))}

                        {/* Empty cells before month starts */}
                        {Array.from({ length: startDay }).map((_, i) => (
                            <div key={`empty-${i}`} className="calendar-widget__empty-cell" />
                        ))}

                        {/* Calendar days */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
                            const dayEvents = events[dateStr] || [];
                            const filteredEvents = getFilteredEvents(dayEvents);
                            const isToday = dateStr === new Date().toISOString().split('T')[0];

                            return (
                                <div key={day} className={`calendar-widget__day-cell ${isToday ? 'calendar-widget__day-cell--today' : ''}`}>
                                    <div className="calendar-widget__day-number">
                                        {day}
                                    </div>
                                    <div className="calendar-widget__events">
                                        {filteredEvents.map((ev, idx) => (
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
                )}

                {/* Empty state */}
                {!loading && !error && Object.keys(events).length === 0 && (
                    <WidgetStateMessage
                        variant="empty"
                        emptyIcon={CalendarIcon}
                        emptyTitle="No Releases This Month"
                        emptySubtitle="Try navigating to a different month"
                    />
                )}
            </div>
        </>
    );
};

export default CombinedCalendarWidget;
