/**
 * Prowlarr Widget
 *
 * Indexer health with Sonarr-style summary chips, apps strip,
 * Tautulli-style tabs (Indexers | Activity | Messages when present).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { History, MessageSquareWarning, Search } from 'lucide-react';
import { WidgetStateMessage } from '../../shared/widgets';
import { useWidgetIntegration } from '../../shared/widgets/hooks/useWidgetIntegration';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { useProwlarrData } from './hooks/useProwlarrData';
import SummaryBar from './components/SummaryBar';
import HealthMessageBanner from './components/HealthMessageBanner';
import IndexerListRow from './components/IndexerListRow';
import ActivityPanel from './components/ActivityPanel';
import TabBar, { type TabBarItem } from './components/TabBar';
import type { WidgetProps } from '../types';
import type { ProwlarrIndexerHealth, ProwlarrSummary } from './prowlarr.types';
import './styles.css';

interface ProwlarrWidgetConfig {
    integrationId?: string;
    showSummaryBar?: string;
    showApplications?: string;
}

type ProwlarrTabId = 'indexers' | 'activity' | 'messages';

const BASE_TABS: TabBarItem[] = [
    { id: 'indexers', label: 'Indexers', shortLabel: 'Index', icon: Search },
    { id: 'activity', label: 'Recent Activity', shortLabel: 'Activity', icon: History },
];

const PREVIEW_SUMMARY: ProwlarrSummary = {
    total: 6,
    enabled: 6,
    healthy: 5,
    failing: 1,
    disabled: 0,
};

const PREVIEW_INDEXERS: ProwlarrIndexerHealth[] = [
    {
        id: 1,
        name: 'Indexer-1',
        protocol: 'torrent',
        privacy: 'private',
        enabled: true,
        priority: 25,
        status: 'healthy',
        disabledTill: null,
        mostRecentFailure: null,
        failureMessage: null,
        cloudflareSuspected: false,
    },
    {
        id: 2,
        name: 'Indexer-2',
        protocol: 'usenet',
        privacy: 'public',
        enabled: true,
        priority: 10,
        status: 'healthy',
        disabledTill: null,
        mostRecentFailure: null,
        failureMessage: null,
        cloudflareSuspected: false,
    },
    {
        id: 3,
        name: 'Indexer-3',
        protocol: 'torrent',
        privacy: 'private',
        enabled: true,
        priority: 25,
        status: 'failing',
        disabledTill: new Date(Date.now() + 3600000).toISOString(),
        mostRecentFailure: new Date(Date.now() - 180000).toISOString(),
        failureMessage: 'Connection timed out',
        cloudflareSuspected: true,
    },
];

function PreviewMode(): React.JSX.Element {
    return (
        <div className="prwl-widget">
            <SummaryBar summary={PREVIEW_SUMMARY} />
            <div className="prwl-list">
                {PREVIEW_INDEXERS.map((indexer) => (
                    <div key={indexer.id} className="prwl-list-row prwl-list-row--static">
                        <div className="prwl-list-row-main">
                            <span className="prwl-list-row-title">{indexer.name}</span>
                            <span className="prwl-list-row-meta">
                                {indexer.protocol} · {indexer.privacy}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const ProwlarrWidget: React.FC<WidgetProps> = ({ widget, previewMode = false }) => {
    if (previewMode) {
        return <PreviewMode />;
    }

    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    const config = widget.config as ProwlarrWidgetConfig | undefined;
    const configuredIntegrationId = config?.integrationId;
    const showSummaryBar = config?.showSummaryBar !== 'false';
    const showApplications = config?.showApplications !== 'false';

    const [activeTab, setActiveTab] = useState<ProwlarrTabId>('indexers');

    const {
        effectiveIntegrationId,
        effectiveDisplayName,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('prowlarr', configuredIntegrationId, widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    const data = useProwlarrData({ integrationId, enabled: isIntegrationBound });

    const hasMessages = data.healthMessages.length > 0;

    const tabs = useMemo((): TabBarItem[] => {
        if (!hasMessages) return BASE_TABS;
        return [
            ...BASE_TABS,
            {
                id: 'messages',
                label: `Messages (${data.healthMessages.length})`,
                shortLabel: `Msgs (${data.healthMessages.length})`,
                icon: MessageSquareWarning,
            },
        ];
    }, [hasMessages, data.healthMessages.length]);

    useEffect(() => {
        if (activeTab === 'messages' && !hasMessages) {
            setActiveTab('indexers');
        }
    }, [activeTab, hasMessages]);

    const isCompact = widget.h <= 2;

    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (accessStatus === 'noAccess') {
        return <WidgetStateMessage variant="noAccess" serviceName="Prowlarr" />;
    }

    if (accessStatus === 'disabled') {
        return <WidgetStateMessage variant="disabled" serviceName="Prowlarr" isAdmin={userIsAdmin} />;
    }

    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return <WidgetStateMessage variant="notConfigured" serviceName="Prowlarr" isAdmin={userIsAdmin} />;
    }

    if (data.error) {
        return (
            <WidgetStateMessage
                variant="error"
                serviceName="Prowlarr"
                instanceName={effectiveDisplayName}
                message={data.error}
            />
        );
    }

    if (data.loading && data.indexers.length === 0) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (data.indexers.length === 0) {
        return (
            <WidgetStateMessage
                variant="empty"
                emptyIcon={Search}
                emptyTitle="No Data"
                emptySubtitle="No indexers returned from Prowlarr"
            />
        );
    }

    const summary = data.summary ?? {
        total: data.indexers.length,
        enabled: data.indexers.filter((i) => i.enabled).length,
        healthy: data.indexers.filter((i) => i.status === 'healthy').length,
        failing: data.indexers.filter((i) => i.status === 'failing').length,
        disabled: data.indexers.filter((i) => i.status === 'disabled').length,
    };

    if (isCompact) {
        return (
            <div className="prwl-widget prwl-widget--compact">
                <SummaryBar
                    summary={summary}
                    compact
                    showSummaryBar={showSummaryBar}
                    isAdmin={userIsAdmin}
                    testingAll={data.testingAll}
                    onTestAll={data.testAllIndexers}
                />
            </div>
        );
    }

    return (
        <div className="prwl-widget">
            <SummaryBar
                summary={summary}
                applications={data.applications}
                showSummaryBar={showSummaryBar}
                showApplications={showApplications}
                isAdmin={userIsAdmin}
                testingAll={data.testingAll}
                onTestAll={data.testAllIndexers}
            />

            <TabBar
                tabs={tabs}
                activeId={activeTab}
                onChange={(id) => setActiveTab(id as ProwlarrTabId)}
                aria-label="Prowlarr views"
            />

            <div className="prwl-tab-body" role="tabpanel">
                {activeTab === 'indexers' && (
                    <div className="prwl-list">
                        {data.indexers.map((indexer) => (
                            <IndexerListRow
                                key={indexer.id}
                                indexer={indexer}
                                isAdmin={userIsAdmin}
                                togglingIndexerId={data.togglingIndexerId}
                                testingIndexerId={data.testingIndexerId}
                                onToggleEnabled={data.toggleIndexerEnabled}
                                onTestIndexer={data.testIndexer}
                            />
                        ))}
                    </div>
                )}

                <ActivityPanel fetchActivity={data.fetchActivity} active={activeTab === 'activity'} />

                {activeTab === 'messages' && hasMessages && (
                    <HealthMessageBanner healthMessages={data.healthMessages} />
                )}
            </div>
        </div>
    );
};

export default ProwlarrWidget;
