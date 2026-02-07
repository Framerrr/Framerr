/**
 * System Status Widget
 * 
 * Displays CPU, Memory, Temperature, and Uptime metrics.
 * Each metric (except uptime) opens a graph popover on click.
 * Uses CSS Container Queries for responsive vertical centering.
 */

import React, { useState, useMemo } from 'react';
import { Activity, Disc, Thermometer, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { WidgetStateMessage, useWidgetIntegration, useIntegrationSSE } from '../../shared/widgets';
import MetricGraphPopover from './popovers/MetricGraphPopover';
import { StatusData, SystemStatusWidgetProps } from './types';
import './styles.css';

// Preview mode mock data
const PREVIEW_DATA: StatusData = {
    cpu: 45,
    memory: 68,
    temperature: 52,
    uptime: '14d 6h'
};

// Default data for when no valid source data is available
const DEFAULT_DATA: StatusData = {
    cpu: 0,
    memory: 0,
    temperature: 0,
    uptime: '--'
};

const SystemStatusWidget: React.FC<SystemStatusWidgetProps> = ({ widget, previewMode = false }) => {
    // Preview mode: render mock data without hooks
    if (previewMode) {
        return (
            <div className="system-status-widget">
                <div className="system-status-widget__content">
                    {[
                        { icon: Activity, label: 'CPU', value: PREVIEW_DATA.cpu, unit: '%' },
                        { icon: Disc, label: 'Memory', value: PREVIEW_DATA.memory, unit: '%' },
                        { icon: Thermometer, label: 'Temp', value: PREVIEW_DATA.temperature, unit: '°C' },
                        { icon: Clock, label: 'Uptime', value: null, display: PREVIEW_DATA.uptime },
                    ].map((m, i) => {
                        const getColor = (v: number) => v < 50 ? 'var(--success)' : v < 80 ? 'var(--warning)' : 'var(--error)';
                        return (
                            <div key={i} className="system-status-widget__metric">
                                <div className="system-status-widget__metric-header">
                                    <span className="system-status-widget__metric-label">
                                        <m.icon size={14} />
                                        {m.label}
                                    </span>
                                    <span className="system-status-widget__metric-value">{m.display || `${m.value}${m.unit}`}</span>
                                </div>
                                {m.value !== null && (
                                    <div className="system-status-widget__progress">
                                        <div
                                            className="system-status-widget__progress-fill"
                                            style={{ width: `${m.value}%`, background: getColor(m.value) }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Check if integration is bound
    const config = widget.config as { integrationId?: string } | undefined;
    const configuredIntegrationId = config?.integrationId;

    // Use unified access hook for widget + integration access
    const {
        effectiveIntegrationId,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('system-status', configuredIntegrationId, widget.id);

    // Use the effective integration ID (may be fallback)
    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    // Glances doesn't have a compatible /history endpoint
    const isGlances = integrationId?.startsWith('glances-');
    const historyEnabled = !isGlances;

    // State includes sourceId to prevent stale data display when switching integrations
    // This prevents flashing when both old and new SSE subscriptions briefly overlap
    const [statusState, setStatusState] = useState<{
        sourceId: string | null;
        data: StatusData;
    }>({ sourceId: null, data: DEFAULT_DATA });

    // Phase 24: Use reusable SSE hook for real-time updates
    // P9: Also get isConnected to prevent premature empty state
    const integrationType = integrationId?.split('-')[0] || 'glances';
    const { loading, isConnected } = useIntegrationSSE<StatusData>({
        integrationType,
        integrationId,
        enabled: isIntegrationBound,
        onData: (sseData) => {
            // Tag data with the integration ID at subscription time
            setStatusState({
                sourceId: integrationId || null,
                data: {
                    cpu: sseData.cpu || 0,
                    memory: sseData.memory || 0,
                    temperature: sseData.temperature || 0,
                    uptime: sseData.uptime || '--'
                }
            });
        },
    });

    // Derive display data - only use if source matches current integration
    // This prevents stale data from old subscription from being displayed
    const statusData = useMemo(() => {
        return statusState.sourceId === integrationId
            ? statusState.data
            : DEFAULT_DATA;
    }, [statusState, integrationId]);

    // Early returns after hooks

    // Handle access loading state
    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Widget not shared to user
    if (accessStatus === 'noAccess') {
        return (
            <WidgetStateMessage
                variant="noAccess"
                serviceName="System Health"
            />
        );
    }

    // Widget shared but no integrations available
    if (accessStatus === 'disabled') {
        return (
            <WidgetStateMessage
                variant="disabled"
                serviceName="System Health"
                isAdmin={userIsAdmin}
            />
        );
    }

    // No integration configured
    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return (
            <WidgetStateMessage
                variant="notConfigured"
                serviceName="System Health"
                isAdmin={userIsAdmin}
            />
        );
    }

    // P9: Show loading while SSE not connected OR waiting for first data
    if (loading || !isConnected) {
        return <WidgetStateMessage variant="loading" />;
    }

    return (
        <div className="system-status-widget">
            <div className="system-status-widget__content">
                {/* CPU */}
                <MetricGraphPopover
                    metric="cpu"
                    value={statusData.cpu}
                    icon={Activity}
                    integrationId={integrationId}
                    historyEnabled={historyEnabled}
                />

                {/* Memory */}
                <MetricGraphPopover
                    metric="memory"
                    value={statusData.memory}
                    icon={Disc}
                    integrationId={integrationId}
                    historyEnabled={historyEnabled}
                />

                {/* Temperature */}
                <MetricGraphPopover
                    metric="temperature"
                    value={statusData.temperature}
                    icon={Thermometer}
                    integrationId={integrationId}
                    historyEnabled={historyEnabled}
                />

                {/* Uptime (no graph) */}
                <div className="system-status-widget__metric">
                    <div className="system-status-widget__metric-header">
                        <span className="system-status-widget__metric-label">
                            <Clock size={14} />
                            Uptime
                        </span>
                        <span className="system-status-widget__metric-value">{statusData.uptime}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemStatusWidget;
