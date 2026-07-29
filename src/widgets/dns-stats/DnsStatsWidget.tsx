/**
 * DNS Stats Widget
 *
 * Unified DNS filtering stats for AdGuard Home and Pi-hole.
 */

import React from 'react';
import { Shield } from 'lucide-react';
import { WidgetStateMessage } from '../../shared/widgets';
import { useWidgetIntegration } from '../../shared/widgets/hooks/useWidgetIntegration';
import { useRetryPoll } from '../../shared/widgets/hooks';
import { useDnsStatsData } from './hooks/useDnsStatsData';
import StatsHeader from './components/StatsHeader';
import ProtectionToggle from './components/ProtectionToggle';
import Sparkline from './components/Sparkline';
import TopListsPanel from './components/TopListsPanel';
import type { WidgetProps } from '../types';
import type { DnsStatsData } from './api.types';
import './styles.css';

interface DnsStatsWidgetConfig {
    integrationId?: string;
    showTopBlocked?: boolean;
    showTopClients?: boolean;
    showSparkline?: boolean;
    showTopQueried?: boolean;
    showTopUpstreams?: boolean;
}

const PREVIEW_DATA: DnsStatsData = {
    queriesTotal: 128450,
    queriesBlocked: 38420,
    blockedPercent: 29.9,
    domainsOnList: 84231,
    protectionEnabled: true,
    pauseRemaining: null,
    avgProcessingTimeMs: 12,
    activeClients: 18,
    topBlockedDomains: [
        { domain: 'ads.example.com', count: 4201 },
        { domain: 'tracker.example.net', count: 3102 },
        { domain: 'metrics.example.org', count: 1890 },
    ],
    topQueriedDomains: [
        { domain: 'cdn.example.com', count: 9200 },
        { domain: 'api.example.com', count: 5100 },
    ],
    topClients: [
        { name: 'laptop.local', count: 22000 },
        { name: '192.168.1.50', count: 14000 },
    ],
    topUpstreams: [
        { name: '1.1.1.1', count: 40000, avgResponseMs: 18 },
        { name: '8.8.8.8', count: 12000, avgResponseMs: 24 },
    ],
    sparkline: Array.from({ length: 24 }, (_, i) => ({
        timestamp: Date.now() - (23 - i) * 3600_000,
        queries: 4000 + Math.round(Math.sin(i / 3) * 1500) + i * 40,
        blocked: 900 + Math.round(Math.cos(i / 4) * 400) + i * 10,
    })),
};

function PreviewMode(): React.JSX.Element {
    return (
        <div className="dns-stats-widget">
            <StatsHeader data={PREVIEW_DATA} />
            <div className="dns-stats-divider" />
            <Sparkline points={PREVIEW_DATA.sparkline} />
            <TopListsPanel
                data={PREVIEW_DATA}
                showTopBlocked
                showTopQueried
                showTopClients
                showTopUpstreams
            />
        </div>
    );
}

const DnsStatsWidget: React.FC<WidgetProps> = ({ widget, previewMode = false }) => {
    if (previewMode) {
        return <PreviewMode />;
    }

    const config = widget.config as DnsStatsWidgetConfig | undefined;
    const cfg = config as Record<string, unknown> | undefined;
    const configuredIntegrationId = cfg?.forceClearIntegration ? null : config?.integrationId;
    const showTopBlocked = config?.showTopBlocked !== false;
    const showTopClients = config?.showTopClients !== false;
    const showSparkline = config?.showSparkline !== false;
    const showTopQueried = config?.showTopQueried !== false;
    const showTopUpstreams = config?.showTopUpstreams !== false;

    const {
        effectiveIntegrationId,
        effectiveDisplayName,
        availableIntegrations,
        status,
        isAdmin,
        loading: accessLoading,
    } = useWidgetIntegration('dns-stats', configuredIntegrationId, previewMode ? undefined : widget.id);

    const integrationType = availableIntegrations.find((i) => i.id === effectiveIntegrationId)?.type;
    const integrationId = effectiveIntegrationId ?? undefined;
    const isIntegrationBound = !!integrationId;

    const handleRetry = useRetryPoll(integrationId, integrationType ?? 'dns-stats');

    const { data, isLoading, error, toggleProtection, togglingProtection } = useDnsStatsData({
        integrationType,
        integrationId,
        enabled: status === 'active' && isIntegrationBound && !previewMode,
    });

    const serviceName = integrationType === 'pihole' ? 'Pi-hole' : 'AdGuard Home';

    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (status === 'noAccess') {
        return <WidgetStateMessage variant="noAccess" serviceName={serviceName} />;
    }

    if (status === 'disabled') {
        return <WidgetStateMessage variant="disabled" serviceName={serviceName} isAdmin={isAdmin} />;
    }

    if (status === 'notConfigured' || !isIntegrationBound) {
        return <WidgetStateMessage variant="notConfigured" serviceName={serviceName} isAdmin={isAdmin} />;
    }

    if (error) {
        const isUnavailable = error.includes('unavailable') || error.includes('Unable to reach');
        return (
            <WidgetStateMessage
                variant={isUnavailable ? 'unavailable' : 'error'}
                serviceName={serviceName}
                instanceName={isUnavailable ? effectiveDisplayName : undefined}
                message={isUnavailable ? undefined : error}
                onRetry={isUnavailable ? handleRetry : undefined}
            />
        );
    }

    if (isLoading && !data) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (!data) {
        return (
            <WidgetStateMessage
                variant="empty"
                emptyIcon={Shield}
                emptyTitle="No Data"
                emptySubtitle="Waiting for DNS stats from your integration"
            />
        );
    }

    const showLists = showTopBlocked || showTopQueried || showTopClients || showTopUpstreams;
    const showBody = showSparkline || showLists;

    return (
        <div className="dns-stats-widget">
            <StatsHeader data={data} />
            {isAdmin && (
                <ProtectionToggle
                    protectionEnabled={data.protectionEnabled}
                    togglingProtection={togglingProtection}
                    onToggle={toggleProtection}
                />
            )}
            {showBody && <div className="dns-stats-divider" />}
            {showSparkline && <Sparkline points={data.sparkline ?? []} />}
            <TopListsPanel
                data={data}
                showTopBlocked={showTopBlocked}
                showTopQueried={showTopQueried}
                showTopClients={showTopClients}
                showTopUpstreams={showTopUpstreams}
            />
        </div>
    );
};

export default DnsStatsWidget;
