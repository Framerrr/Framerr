import React from 'react';
import {
    Activity,
    ListFilter,
    Percent,
    Shield,
    ShieldOff,
    Timer,
    Users,
    Ban,
} from 'lucide-react';
import type { DnsStatsData } from '../api.types';

interface StatsHeaderProps {
    data: DnsStatsData;
}

function formatPauseRemaining(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m remaining`;
    }
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s remaining`;
    }
    return `${remainingSeconds}s remaining`;
}

function formatNumber(value: number): string {
    if (Math.abs(value) >= 1000) {
        return new Intl.NumberFormat(undefined, {
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(value);
    }
    return value.toLocaleString();
}

function formatLatency(ms: number): string {
    return ms < 10 ? `${ms.toFixed(1)}ms` : `${Math.round(ms)}ms`;
}

const StatsHeader: React.FC<StatsHeaderProps> = ({ data }) => {
    const ProtectionIcon = data.protectionEnabled ? Shield : ShieldOff;

    const items: { icon: React.ElementType; value: string; label: string }[] = [
        { icon: Activity, value: formatNumber(data.queriesTotal), label: 'Queries' },
        { icon: Ban, value: formatNumber(data.queriesBlocked), label: 'Blocked' },
        { icon: Percent, value: data.blockedPercent.toFixed(1), label: '% Blocked' },
        { icon: ListFilter, value: formatNumber(data.domainsOnList), label: 'On List' },
    ];

    if (data.activeClients !== null) {
        items.push({
            icon: Users,
            value: formatNumber(data.activeClients),
            label: 'Clients',
        });
    }
    if (data.avgProcessingTimeMs !== null) {
        items.push({
            icon: Timer,
            value: formatLatency(data.avgProcessingTimeMs),
            label: 'Avg latency',
        });
    }

    return (
        <div className="dns-stats-header">
            <div className="dns-stats-header-row">
                <span
                    className={`dns-stats-badge inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
                        data.protectionEnabled ? 'text-success bg-success/15' : 'text-error bg-error/15'
                    }`}
                >
                    <ProtectionIcon size={14} />
                    {data.protectionEnabled ? 'Active' : 'Disabled'}
                </span>
                {data.pauseRemaining !== null && data.pauseRemaining > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-theme-tertiary text-theme-secondary">
                        Paused · {formatPauseRemaining(data.pauseRemaining)}
                    </span>
                )}
            </div>

            <div className="dns-stats-summary">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <span
                            key={`${item.label}-${item.value}`}
                            className="dns-stats-summary-item"
                            title={`${item.value} ${item.label}`}
                        >
                            <span className="dns-stats-summary-item-main">
                                <Icon size={11} aria-hidden />
                                <span className="dns-stats-summary-value">{item.value}</span>
                            </span>
                            <span className="dns-stats-summary-label">{item.label}</span>
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

export default StatsHeader;
