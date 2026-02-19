/**
 * MonitorPopover Component
 * 
 * Displays detailed monitor information in a popover:
 * - Current status and response time
 * - 24-hour uptime tick bar
 * - Last/next check times
 * - Maintenance toggle (admin only)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Wrench } from 'lucide-react';
import { Popover } from '@/shared/ui';
import { widgetFetch } from '../../../utils/widgetFetch';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import StatusDot from '../../../components/common/StatusDot';
import logger from '../../../utils/logger';
import { ServiceMonitor, MonitorStatusData, HourlyAggregate } from '../types';

// ============================================================================
// Props
// ============================================================================

export interface MonitorPopoverProps {
    monitor: ServiceMonitor;
    statusData: MonitorStatusData | null;
    /** Timestamp when SSE data was received (for client-side timer calculation) */
    sseReceivedAt: number;
    children: React.ReactNode;
    isAdmin: boolean;
    icon: React.ReactNode;
    onMaintenanceToggle?: (id: string, enabled: boolean) => void;
    editMode?: boolean;
    /** Integration instance ID for proxy routing (required for history fetch) */
    integrationId?: string;
    /** Set to false to disable the popover (e.g., for UK which has no history API) */
    historyEnabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

const MonitorPopover: React.FC<MonitorPopoverProps> = ({
    monitor,
    statusData,
    sseReceivedAt,
    children,
    isAdmin,
    icon,
    onMaintenanceToggle,
    editMode = false,
    integrationId,
    historyEnabled = true
}) => {
    const [open, setOpen] = useState(false);
    const [aggregates, setAggregates] = useState<HourlyAggregate[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Note: Popover primitive handles scroll-close automatically

    // Real-time timer - update every second when popover is open
    useEffect(() => {
        if (!open) return;
        const timer = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, [open]);


    // Open popover and load history
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen) {
            // Reset currentTime to avoid stale timer when switching between monitors
            setCurrentTime(Date.now());
            if (aggregates.length === 0) {
                fetchHistory();
            }
        }
    };

    const fetchHistory = async () => {
        // Skip history for Uptime Kuma - it doesn't have a REST API for heartbeat history
        // Only Framerr's built-in monitor service has history aggregates
        if (integrationId?.startsWith('uptimekuma-')) {
            setLoadingHistory(false);
            return;
        }

        setLoadingHistory(true);
        try {
            // Use proxy route if integrationId is provided (works for framerr monitor)
            const url = integrationId
                ? `/api/integrations/${integrationId}/proxy/monitor/${monitor.id}/history?hours=24`
                : `/api/service-monitors/${monitor.id}/aggregates?hours=24`;
            const response = await widgetFetch(url, 'service-status-history');
            if (response.ok) {
                const data = await response.json();
                setAggregates(data.aggregates || []);
            }
        } catch (error) {
            logger.error('Failed to fetch monitor history', { error });
        } finally {
            setLoadingHistory(false);
        }
    };

    // Calculate timer values based on SSE arrival time (eliminates clock drift)
    // baseOffset = how old was the check when SSE arrived
    // elapsed = how long since SSE arrived (purely local, no server comparison)
    // Total = accurate "time since check"
    const calculateTimerValues = () => {
        const lastCheck = statusData?.lastCheck;
        const intervalSeconds = statusData?.intervalSeconds ?? 60;

        // Guard: No data yet
        if (!lastCheck) {
            return { secondsSince: null, secondsUntil: null, intervalSeconds };
        }

        // Parse lastCheck timestamp
        const lastCheckMs = new Date(lastCheck).getTime();
        if (isNaN(lastCheckMs)) {
            return { secondsSince: null, secondsUntil: null, intervalSeconds };
        }

        // Calculate offset from SSE arrival
        const baseOffset = sseReceivedAt - lastCheckMs;  // How old was check when SSE arrived
        const elapsed = currentTime - sseReceivedAt;      // How long since SSE arrived (local)
        const totalMs = baseOffset + elapsed;
        const secondsSince = Math.floor(totalMs / 1000);

        // Cap at intervalSeconds (don't show "65s ago" for 60s interval)
        const cappedSecondsSince = Math.min(Math.max(0, secondsSince), intervalSeconds);

        // Calculate seconds until next check (clamp at 0)
        const secondsUntil = Math.max(0, intervalSeconds - secondsSince);

        return { secondsSince: cappedSecondsSince, secondsUntil, intervalSeconds };
    };

    // Format last check time
    const formatLastCheck = () => {
        const { secondsSince } = calculateTimerValues();

        if (secondsSince === null) return 'Pending';
        if (secondsSince === 0) return 'Just now';
        if (secondsSince < 60) return `${secondsSince}s ago`;
        if (secondsSince < 3600) return `${Math.floor(secondsSince / 60)}m ago`;
        return `${Math.floor(secondsSince / 3600)}h ago`;
    };

    // Calculate next check
    const formatNextCheck = () => {
        const { secondsUntil } = calculateTimerValues();

        if (secondsUntil === null) return 'Pending';
        if (secondsUntil === 0) return 'Now';
        if (secondsUntil < 60) return `in ${secondsUntil}s`;
        return `in ${Math.floor(secondsUntil / 60)}m`;
    };

    // Build tick bar data (last 24 hours)
    const tickBarData = useMemo(() => {
        const now = new Date();
        const ticks: { hour: number; status: 'up' | 'down' | 'mixed' | 'maintenance' | 'empty' }[] = [];

        for (let i = 23; i >= 0; i--) {
            const hourStart = new Date(now);
            hourStart.setHours(hourStart.getHours() - i, 0, 0, 0);

            const agg = aggregates.find(a => {
                const aggHour = new Date(a.hourStart);
                return aggHour.getHours() === hourStart.getHours() &&
                    aggHour.getDate() === hourStart.getDate();
            });

            if (!agg || (agg.checksTotal === 0 && (!agg.checksMaintenance || agg.checksMaintenance === 0))) {
                ticks.push({ hour: i, status: 'empty' });
            } else if (agg.checksMaintenance && agg.checksMaintenance > 0) {
                // Any maintenance time in this hour shows as grey
                ticks.push({ hour: i, status: 'maintenance' });
            } else if (agg.checksDown > 0) {
                ticks.push({ hour: i, status: 'down' });
            } else if (agg.checksDegraded > 0) {
                ticks.push({ hour: i, status: 'mixed' });
            } else {
                ticks.push({ hour: i, status: 'up' });
            }
        }

        return ticks;
    }, [aggregates]);

    const handleMaintenanceClick = async () => {
        if (!onMaintenanceToggle) return;
        const newState = !statusData?.maintenance;
        onMaintenanceToggle(monitor.id, newState);
    };

    const status = statusData?.status || 'pending';

    // If history is disabled (e.g., Uptime Kuma), render children without popover
    if (!historyEnabled) {
        return <>{children}</>;
    }

    return (
        <Popover open={open} onOpenChange={handleOpenChange} disabled={editMode}>
            <Popover.Trigger asChild>
                {children}
            </Popover.Trigger>
            <Popover.Content
                className="w-72"
                sideOffset={8}
                align="start"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {icon}
                        <span className="font-semibold text-theme-primary">{monitor.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <StatusDot status={status} />
                        <span className={`text-sm font-medium capitalize ${status === 'up' ? 'text-success' :
                            status === 'down' ? 'text-error' :
                                status === 'degraded' ? 'text-warning' :
                                    'text-theme-tertiary'
                            }`}>
                            {status}
                        </span>
                    </div>
                </div>

                {/* Response Time */}
                {statusData && (
                    <div className="text-sm text-theme-secondary mb-3">
                        Response: {statusData.responseTimeMs !== null ? `${statusData.responseTimeMs}ms` : 'N/A'}
                        {statusData.uptimePercent !== null && (
                            <span className="ml-2 text-theme-tertiary">
                                ({statusData.uptimePercent.toFixed(1)}% uptime)
                            </span>
                        )}
                    </div>
                )}

                {/* Tick Bar */}
                <div className="mb-3">
                    <div className="text-xs text-theme-tertiary mb-1">24h Uptime</div>
                    {loadingHistory ? (
                        <div className="h-3 flex items-center justify-center">
                            <LoadingSpinner size="sm" />
                        </div>
                    ) : (
                        <div className="flex gap-0.5">
                            {tickBarData.map((tick, i) => (
                                <div
                                    key={i}
                                    className={`flex-1 h-5 rounded-sm ${tick.status === 'up' ? 'bg-success' :
                                        tick.status === 'down' ? 'bg-error' :
                                            tick.status === 'mixed' ? 'bg-warning' :
                                                tick.status === 'maintenance' ? 'bg-info/40' :
                                                    'bg-theme-tertiary/30'
                                        }`}
                                    title={`${tick.hour === 0 ? 'Now' : `${tick.hour}h ago`}${tick.status === 'maintenance' ? ' (maintenance)' : ''}`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Check Times */}
                <div className="flex justify-between text-xs text-theme-tertiary mb-3">
                    <span>Last check: {formatLastCheck()}</span>
                    <span>Next: {formatNextCheck()}</span>
                </div>

                {/* Actions (Admin Only) */}
                {isAdmin && (
                    <div className="flex gap-2 pt-2 border-t border-theme">
                        <button
                            onClick={handleMaintenanceClick}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${statusData?.maintenance
                                ? 'bg-warning/20 text-warning hover:bg-warning/30'
                                : 'bg-theme-secondary hover:bg-theme-tertiary text-theme-primary'
                                }`}
                        >
                            <Wrench size={14} />
                            {statusData?.maintenance ? 'Exit Maintenance' : 'Maintenance'}
                        </button>
                    </div>
                )}
            </Popover.Content>
        </Popover>
    );
};

export default MonitorPopover;
