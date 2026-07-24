/**
 * TopListsPanel — tabbed Top Blocked / Queried / Clients / Upstreams (config-gated).
 */

import React, { useEffect, useState } from 'react';
import { Ban, Globe, Network, Users } from 'lucide-react';
import { SlidingTabBar, type SlidingTabBarItem } from '../../../shared/ui';
import RankedList, { type RankedListItem } from './RankedList';
import type { DnsStatsData } from '../api.types';

export type TopListTabId = 'blocked' | 'queried' | 'clients' | 'upstreams';

interface TopListsVisibility {
    showTopBlocked: boolean;
    showTopQueried: boolean;
    showTopClients: boolean;
    showTopUpstreams: boolean;
}

interface TopListsPanelProps extends TopListsVisibility {
    data: DnsStatsData;
}

const TAB_META: Record<
    TopListTabId,
    { label: string; shortLabel: string; icon: SlidingTabBarItem['icon'] }
> = {
    blocked: { label: 'Top Blocked', shortLabel: 'Blocked', icon: Ban },
    queried: { label: 'Top Queried', shortLabel: 'Queried', icon: Globe },
    clients: { label: 'Top Clients', shortLabel: 'Clients', icon: Users },
    upstreams: { label: 'Top Upstreams', shortLabel: 'Upstream', icon: Network },
};

function formatAvgMs(ms: number): string {
    return ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`;
}

function itemsForTab(data: DnsStatsData, tabId: TopListTabId): RankedListItem[] {
    switch (tabId) {
        case 'blocked':
            return (data.topBlockedDomains ?? []).map((d) => ({
                label: d.domain,
                count: d.count,
            }));
        case 'queried':
            return (data.topQueriedDomains ?? []).map((d) => ({
                label: d.domain,
                count: d.count,
            }));
        case 'clients':
            return (data.topClients ?? []).map((c) => ({
                label: c.name,
                count: c.count,
            }));
        case 'upstreams':
            return (data.topUpstreams ?? []).map((u) => ({
                label: u.name,
                count: u.count,
                meta: u.avgResponseMs != null ? formatAvgMs(u.avgResponseMs) : null,
            }));
        default:
            return [];
    }
}

const TopListsPanel: React.FC<TopListsPanelProps> = ({
    data,
    showTopBlocked,
    showTopQueried,
    showTopClients,
    showTopUpstreams,
}) => {
    const showBlocked = showTopBlocked;
    const showQueried = showTopQueried;
    const showClients = showTopClients;
    const showUpstreams = showTopUpstreams;

    const enabledIds: TopListTabId[] = [];
    if (showBlocked) enabledIds.push('blocked');
    if (showQueried) enabledIds.push('queried');
    if (showClients) enabledIds.push('clients');
    if (showUpstreams) enabledIds.push('upstreams');

    const [activeId, setActiveId] = useState<TopListTabId>('blocked');

    useEffect(() => {
        const ids: TopListTabId[] = [];
        if (showBlocked) ids.push('blocked');
        if (showQueried) ids.push('queried');
        if (showClients) ids.push('clients');
        if (showUpstreams) ids.push('upstreams');
        if (ids.length === 0) return;
        if (!ids.includes(activeId)) {
            queueMicrotask(() => setActiveId(ids[0]));
        }
    }, [showBlocked, showQueried, showClients, showUpstreams, activeId]);

    if (enabledIds.length === 0) return null;

    const tabs: SlidingTabBarItem[] = enabledIds.map((id) => ({
        id,
        ...TAB_META[id],
    }));

    const items = itemsForTab(data, activeId);

    return (
        <div className="dns-stats-top-lists">
            {tabs.length > 1 ? (
                <SlidingTabBar
                    tabs={tabs}
                    activeId={activeId}
                    onChange={(id) => setActiveId(id as TopListTabId)}
                    aria-label="Top lists"
                />
            ) : (
                <h4 className="dns-stats-ranked-title text-theme-secondary">
                    {TAB_META[activeId].label}
                </h4>
            )}
            <div className="dns-stats-top-lists-body" role="tabpanel">
                {items.length > 0 ? (
                    <RankedList items={items} />
                ) : (
                    <p className="dns-stats-top-lists-empty text-theme-secondary">No data yet</p>
                )}
            </div>
        </div>
    );
};

export default TopListsPanel;
