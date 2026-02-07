/**
 * Service Status Widget
 * 
 * Displays a compact grid of service monitors with status indicators.
 * Clicking a monitor opens a popover with detailed info and tick-bar uptime.
 */

import React from 'react';
import { Server } from 'lucide-react';
import { getIconComponent } from '../../utils/iconUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { WidgetStateMessage, useWidgetIntegration } from '../../shared/widgets';
import StatusDot from '../../components/common/StatusDot';
import MonitorPopover from './popovers/MonitorPopover';
import { useServiceStatus } from './hooks/useServiceStatus';
import { useServiceLayout } from './hooks/useServiceLayout';
import {
    COMPACT_CONFIG,
    ULTRA_COMPACT_CONFIG,
    EXPANDED_CONFIG,
    COMPACT_CARD_HEIGHT,
    ULTRA_COMPACT_THRESHOLD
} from './utils/layoutUtils';
import { ServiceStatusWidgetProps } from './types';

import './styles.css';

// ============================================================================
// Main Widget Component
// ============================================================================

// Preview mode mock services
const PREVIEW_MONITORS = [
    { id: '1', name: 'Plex', iconName: 'Film' },
    { id: '2', name: 'Radarr', iconName: 'Film' },
    { id: '3', name: 'Sonarr', iconName: 'Tv' },
    { id: '4', name: 'Prowlarr', iconName: 'Search' },
    { id: '5', name: 'SABnzbd', iconName: 'Download' },
    { id: '6', name: 'Docker', iconName: 'Container' },
];

// Preview-only render component using shared layout hook
interface ServiceStatusPreviewProps {
    containerHeight?: number;
    containerWidth?: number;
    transformScale?: number;
}

const ServiceStatusPreview: React.FC<ServiceStatusPreviewProps> = ({ containerHeight, containerWidth, transformScale }) => {
    const { containerRef, layout } = useServiceLayout({
        itemCount: PREVIEW_MONITORS.length,
        containerHeight,
        containerWidth,
        transformScale
    });

    const layoutGap = layout.variant === 'ultra-compact'
        ? ULTRA_COMPACT_CONFIG.gap
        : layout.variant === 'compact'
            ? COMPACT_CONFIG.gap
            : EXPANDED_CONFIG.gap;

    const containerPadding = layout.variant === 'compact' || layout.variant === 'ultra-compact' ? 2 : 8;

    const gridStyle: React.CSSProperties = {
        display: 'flex',
        flexWrap: layout.variant === 'expanded' ? 'wrap' : 'nowrap',
        gap: `${layoutGap}px`,
        justifyContent: 'center',
        alignItems: 'center',
        // Anchor rows to top for expanded (multi-row), center for compact variants
        alignContent: layout.variant === 'expanded' ? 'flex-start' : 'center',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
    };

    const visibleMonitors = PREVIEW_MONITORS.slice(0, layout.visibleCount);
    const iconSize = layout.variant === 'compact'
        ? 18
        : Math.min(48, Math.max(20, Math.floor(layout.cardSize * 0.4)));

    return (
        <div
            ref={containerRef}
            className="service-status-container"
            style={{
                padding: `${containerPadding}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div style={gridStyle}>
                {visibleMonitors.map((m) => {
                    const IconComponent = getIconComponent(m.iconName);
                    const isCompact = layout.variant === 'compact';
                    const isUltraCompact = layout.variant === 'ultra-compact';

                    return (
                        <div
                            key={m.id}
                            className="service-card"
                            style={{
                                width: isCompact || isUltraCompact ? `${layout.cardSize}px` : `${layout.cardSize}px`,
                                height: isCompact || isUltraCompact ? `${COMPACT_CARD_HEIGHT}px` : `${layout.cardSize}px`,
                                display: 'flex',
                                flexDirection: isCompact || isUltraCompact ? 'row' : 'column',
                                alignItems: 'center',
                                justifyContent: isCompact || isUltraCompact ? 'flex-start' : 'center',
                                gap: isCompact || isUltraCompact ? '6px' : '4px',
                                padding: isCompact || isUltraCompact ? '0 8px' : '8px',
                            }}
                        >
                            <IconComponent className="text-accent flex-shrink-0" size={iconSize} />
                            {/* Name only shown in compact/expanded, hidden in ultra-compact */}
                            {layout.variant !== 'ultra-compact' && layout.cardSize >= ULTRA_COMPACT_THRESHOLD && (
                                <span
                                    className="text-theme-primary font-medium"
                                    style={{
                                        fontSize: isCompact ? '0.75rem' : `${Math.min(14, Math.max(10, layout.cardSize * 0.12))}px`,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {m.name}
                                </span>
                            )}
                            <span
                                className="flex-shrink-0"
                                style={{
                                    width: isCompact || isUltraCompact ? '8px' : '10px',
                                    height: isCompact || isUltraCompact ? '8px' : '10px',
                                    borderRadius: '50%',
                                    background: 'var(--success)',
                                    marginLeft: isCompact || isUltraCompact ? 'auto' : undefined,
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ServiceStatusWidget: React.FC<ServiceStatusWidgetProps> = ({ widget, isEditMode = false, previewMode = false, containerHeight, containerWidth }) => {
    // Preview mode: render mock service grid using shared layout hook
    if (previewMode) {
        return <ServiceStatusPreview containerHeight={containerHeight} containerWidth={containerWidth} />;
    }

    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Get integration ID from widget config
    const config = widget.config as { integrationId?: string } | undefined;
    const configuredIntegrationId = config?.integrationId;

    // Use the unified access hook for widget + integration access
    const {
        effectiveIntegrationId,
        status: accessStatus,
        isFallback,
        isAdmin: hookIsAdmin,
        loading: accessLoading,
    } = useWidgetIntegration('service-status', configuredIntegrationId, widget.id);

    // Use the bound integration ID (may be fallback)
    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    // Uptime Kuma doesn't have a compatible /history endpoint for popover
    const isUptimeKuma = integrationId?.startsWith('uptimekuma-');
    const historyEnabled = !isUptimeKuma;

    // Use the data hook - now always passes valid integrationId or undefined
    const {
        monitors,
        statuses,
        sseReceivedAt,
        loading: dataLoading,
        error,
        containerRef,
        layout,
        handleMaintenanceToggle
    } = useServiceStatus({ integrationId, isIntegrationBound });

    // Handle access states from unified hook
    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Widget not shared to user
    if (accessStatus === 'noAccess') {
        return (
            <WidgetStateMessage
                variant="noAccess"
                serviceName="Service Monitoring"
            />
        );
    }

    // Widget shared but no integrations available
    if (accessStatus === 'disabled') {
        return (
            <WidgetStateMessage
                variant="disabled"
                serviceName="Service Monitoring"
                isAdmin={userIsAdmin}
            />
        );
    }

    // No integration configured
    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return (
            <WidgetStateMessage
                variant="notConfigured"
                serviceName="Service Monitoring"
                isAdmin={userIsAdmin}
            />
        );
    }

    // Error state
    if (error) {
        return (
            <WidgetStateMessage
                variant="error"
                serviceName="Service Monitoring"
                message={error}
            />
        );
    }

    // Loading state
    if (dataLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Empty state
    if (monitors.length === 0) {
        return (
            <WidgetStateMessage
                variant="empty"
                emptyIcon={Server}
                emptyTitle="No Monitors Configured"
                emptySubtitle={userIsAdmin ? "Add monitors in integration settings" : "No monitors have been shared with you"}
            />
        );
    }

    // Get icon component from iconName or iconId
    const getIcon = (iconName: string | null, iconId: string | null) => {
        return getIconComponent(iconName || iconId);
    };

    // Calculate layout gap based on variant
    const layoutGap = layout.variant === 'ultra-compact'
        ? ULTRA_COMPACT_CONFIG.gap
        : layout.variant === 'compact'
            ? COMPACT_CONFIG.gap
            : EXPANDED_CONFIG.gap;

    const gridStyle: React.CSSProperties = {
        display: 'flex',
        flexWrap: layout.variant === 'expanded' ? 'wrap' : 'nowrap',
        gap: `${layoutGap}px`,
        justifyContent: 'center',
        alignItems: 'center',
        // Anchor rows to top for expanded (multi-row), center for compact variants
        alignContent: layout.variant === 'expanded' ? 'flex-start' : 'center',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
    };

    // Only show visible monitors based on layout
    const visibleMonitors = monitors.slice(0, layout.visibleCount);

    // Calculate icon size
    const iconSize = layout.variant === 'compact'
        ? 18
        : Math.min(48, Math.max(20, Math.floor(layout.cardSize * 0.4)));

    // Adaptive padding
    const containerPadding = layout.variant === 'compact' || layout.variant === 'ultra-compact' ? 2 : 8;

    return (
        <div
            ref={containerRef}
            className="service-status-container"
            style={{
                height: '100%',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${containerPadding}px`,
                boxSizing: 'border-box',
            }}
        >
            <div style={gridStyle}>
                <AnimatePresence mode="popLayout">
                    {visibleMonitors.map((monitor) => {
                        const statusData = statuses[monitor.id] || null;
                        const status = statusData?.status || 'pending';
                        const IconComponent = getIcon(monitor.iconName, monitor.iconId);

                        // Dynamic card styles based on layout variant
                        const cardStyle: React.CSSProperties = layout.variant === 'ultra-compact'
                            ? {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.3rem',
                                padding: '0.3rem 0.4rem',
                                width: `${layout.cardSize}px`,
                                height: `${COMPACT_CARD_HEIGHT}px`,
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '0.5rem',
                                border: 'none',
                                cursor: 'pointer',
                            }
                            : layout.variant === 'compact'
                                ? {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.3rem 0.5rem',
                                    width: `${layout.cardSize}px`,
                                    height: `${COMPACT_CARD_HEIGHT}px`,
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    cursor: 'pointer',
                                }
                                : {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: `${Math.max(4, layout.cardSize * 0.08)}px`,
                                    width: `${layout.cardSize}px`,
                                    height: `${layout.cardSize}px`,
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: `${Math.min(12, layout.cardSize * 0.12)}px`,
                                    border: 'none',
                                    cursor: 'pointer',
                                    position: 'relative',
                                };

                        return (
                            <motion.div
                                key={monitor.id}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                            >
                                <MonitorPopover
                                    monitor={monitor}
                                    statusData={statusData}
                                    sseReceivedAt={sseReceivedAt}
                                    isAdmin={userIsAdmin}
                                    icon={<IconComponent className="text-accent" size={16} />}
                                    onMaintenanceToggle={handleMaintenanceToggle}
                                    editMode={isEditMode}
                                    integrationId={integrationId}
                                    historyEnabled={historyEnabled}
                                >
                                    <button
                                        className={`service-card text-theme-primary bg-theme-tertiary border border-theme hover:bg-white/10 transition-colors ${layout.variant === 'expanded' ? 'rounded-xl' : 'rounded-full'
                                            }`}
                                        style={cardStyle}
                                    >
                                        {layout.variant === 'ultra-compact' ? (
                                            <>
                                                <IconComponent className="text-accent flex-shrink-0" size={16} />
                                                <StatusDot status={status} size="sm" />
                                            </>
                                        ) : layout.variant === 'compact' ? (
                                            <>
                                                <IconComponent className="text-accent flex-shrink-0" size={iconSize} />
                                                <span
                                                    className="text-base font-medium overflow-hidden text-ellipsis whitespace-nowrap flex-1"
                                                >
                                                    {monitor.name}
                                                </span>
                                                <span className="flex-shrink-0">
                                                    <StatusDot status={status} size="sm" />
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span
                                                    className="text-theme-primary font-medium text-center overflow-hidden text-ellipsis whitespace-nowrap w-full"
                                                    style={{ fontSize: `${Math.max(10, Math.min(14, layout.cardSize * 0.12))}px` }}
                                                >
                                                    {monitor.name}
                                                </span>
                                                <div className="flex-grow flex items-center justify-center">
                                                    <IconComponent size={iconSize} className="text-accent" />
                                                </div>
                                                <span
                                                    className="absolute"
                                                    style={{ bottom: `${Math.max(4, layout.cardSize * 0.06)}px`, right: `${Math.max(4, layout.cardSize * 0.06)}px` }}
                                                >
                                                    <StatusDot status={status} />
                                                </span>
                                            </>
                                        )}
                                    </button>
                                </MonitorPopover>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ServiceStatusWidget;
