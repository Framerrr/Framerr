/**
 * IndexerDetailPopover — detail popover matching Service Status MonitorPopover patterns.
 */

import React, { useState } from 'react';
import { Loader2, Power, Search } from 'lucide-react';
import { Popover, StatusDot, type MonitorStatus } from '@/shared/ui';
import type { ProwlarrIndexerHealth } from '../prowlarr.types';

interface IndexerDetailPopoverProps {
    indexer: ProwlarrIndexerHealth;
    isAdmin: boolean;
    togglingIndexerId: number | null;
    onToggleEnabled: (indexerId: number, enabled: boolean) => Promise<void>;
    children: React.ReactNode;
}

function mapStatus(status: ProwlarrIndexerHealth['status']): MonitorStatus {
    switch (status) {
        case 'healthy':
            return 'up';
        case 'failing':
            return 'down';
        case 'disabled':
            return 'maintenance';
        default:
            return 'pending';
    }
}

function formatRelativeTime(iso: string | null): string {
    if (!iso) return '—';
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return '—';

    const diffSec = Math.floor((Date.now() - ms) / 1000);
    if (diffSec < 0) {
        const futureSec = Math.abs(diffSec);
        if (futureSec < 60) return `in ${futureSec}s`;
        if (futureSec < 3600) return `in ${Math.floor(futureSec / 60)}m`;
        return `in ${Math.floor(futureSec / 3600)}h`;
    }
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
}

const IndexerDetailPopover: React.FC<IndexerDetailPopoverProps> = ({
    indexer,
    isAdmin,
    togglingIndexerId,
    onToggleEnabled,
    children,
}) => {
    const [open, setOpen] = useState(false);
    const isToggling = togglingIndexerId === indexer.id;

    const handleToggle = () => {
        if (isToggling) return;
        void onToggleEnabled(indexer.id, !indexer.enabled);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>{children}</Popover.Trigger>
            <Popover.Content className="w-72" sideOffset={8} align="start">
                <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Search size={16} className="text-accent flex-shrink-0" />
                        <span className="font-semibold text-theme-primary truncate">{indexer.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <StatusDot status={mapStatus(indexer.status)} />
                        <span
                            className={`text-sm font-medium capitalize ${
                                indexer.status === 'healthy'
                                    ? 'text-success'
                                    : indexer.status === 'failing'
                                      ? 'text-error'
                                      : 'text-theme-tertiary'
                            }`}
                        >
                            {indexer.status}
                        </span>
                    </div>
                </div>

                <div className="space-y-2 text-sm mb-3">
                    <div className="flex justify-between gap-2">
                        <span className="text-theme-tertiary">Protocol</span>
                        <span className="text-theme-secondary">
                            {indexer.protocol} ({indexer.privacy})
                        </span>
                    </div>
                    <div className="flex justify-between gap-2">
                        <span className="text-theme-tertiary">Priority</span>
                        <span className="text-theme-secondary">{indexer.priority}</span>
                    </div>
                    {indexer.disabledTill && (
                        <div className="flex justify-between gap-2">
                            <span className="text-theme-tertiary">Disabled until</span>
                            <span className="text-theme-secondary">{formatRelativeTime(indexer.disabledTill)}</span>
                        </div>
                    )}
                    {indexer.mostRecentFailure && (
                        <div className="flex justify-between gap-2">
                            <span className="text-theme-tertiary">Last failure</span>
                            <span className="text-theme-secondary">{formatRelativeTime(indexer.mostRecentFailure)}</span>
                        </div>
                    )}
                </div>

                {indexer.failureMessage ? (
                    <p className="text-sm text-theme-secondary mb-3 whitespace-pre-wrap">{indexer.failureMessage}</p>
                ) : indexer.status === 'healthy' ? (
                    <p className="text-sm text-theme-tertiary mb-3">No recent failures.</p>
                ) : indexer.status === 'disabled' ? (
                    <p className="text-sm text-theme-tertiary mb-3">Manually disabled.</p>
                ) : null}

                {indexer.cloudflareSuspected && (
                    <span className="inline-block text-xs bg-warning/20 text-warning px-2 py-1 rounded mb-3">
                        Cloudflare/FlareSolverr
                    </span>
                )}

                {isAdmin && (
                    <div className="flex gap-2 pt-2 border-t border-theme">
                        <button
                            type="button"
                            onClick={handleToggle}
                            disabled={isToggling}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 ${
                                indexer.enabled
                                    ? 'bg-theme-secondary hover:bg-theme-tertiary text-theme-primary'
                                    : 'bg-warning/20 text-warning hover:bg-warning/30'
                            }`}
                        >
                            {isToggling ? <Loader2 size={14} className="prwl-test-all-spinner" /> : <Power size={14} />}
                            {indexer.enabled ? 'Disable' : 'Enable'}
                        </button>
                    </div>
                )}
            </Popover.Content>
        </Popover>
    );
};

export default IndexerDetailPopover;
