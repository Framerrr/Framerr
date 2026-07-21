import React, { useState, useCallback, useEffect } from 'react';
import { LoadingSpinner } from '@/shared/ui';
import type { ProwlarrActivityData } from '../prowlarr.types';

interface ActivityPanelProps {
    fetchActivity: (page?: number, startDate?: string, endDate?: string) => Promise<ProwlarrActivityData>;
    /** When true, panel is visible (tab selected) and should auto-load once */
    active: boolean;
}

function formatRelativeDate(iso: string): string {
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return iso;
    const diffSec = Math.floor((Date.now() - ms) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
}

const ActivityPanel: React.FC<ActivityPanelProps> = ({ fetchActivity, active }) => {
    const [loading, setLoading] = useState(false);
    const [activity, setActivity] = useState<ProwlarrActivityData | null>(null);
    const [fetched, setFetched] = useState(false);

    const load = useCallback(async () => {
        if (fetched || loading) return;
        setLoading(true);
        const data = await fetchActivity();
        setActivity(data);
        setFetched(true);
        setLoading(false);
    }, [fetched, loading, fetchActivity]);

    useEffect(() => {
        if (active) {
            void load();
        }
    }, [active, load]);

    if (!active) return null;

    return (
        <div className="prwl-activity">
            {loading && (
                <div className="prwl-activity-loading">
                    <LoadingSpinner size="sm" />
                </div>
            )}

            {!loading && activity?.error && (
                <p className="prwl-activity-error">{activity.error}</p>
            )}

            {!loading && activity && !activity.error && (
                <>
                    {activity.stats && (
                        <div className="prwl-header-chips prwl-activity-stats">
                            <span className="prwl-header-chip prwl-header-chip--total">
                                {activity.stats.queries.toLocaleString()} queries
                            </span>
                            <span className="prwl-header-chip prwl-header-chip--healthy">
                                {activity.stats.grabs.toLocaleString()} grabs
                            </span>
                            <span className="prwl-header-chip prwl-header-chip--total">
                                {activity.stats.avgResponseMs}ms avg
                            </span>
                        </div>
                    )}

                    <div className="prwl-list">
                        {activity.history.length === 0 ? (
                            <p className="prwl-empty-hint">No recent history.</p>
                        ) : (
                            activity.history.map((entry) => (
                                <div key={entry.id} className="prwl-list-row prwl-list-row--static">
                                    <div className="prwl-list-row-main">
                                        <span className="prwl-list-row-title">{entry.indexerName}</span>
                                        <span className="prwl-list-row-meta">
                                            {entry.eventLabel}
                                            {entry.detail ? ` · ${entry.detail}` : ''}
                                        </span>
                                    </div>
                                    <span className="prwl-list-row-time">{formatRelativeDate(entry.date)}</span>
                                    <span
                                        className={`prwl-list-row-status ${
                                            entry.successful ? 'text-success' : 'text-error'
                                        }`}
                                    >
                                        {entry.successful ? 'ok' : 'fail'}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ActivityPanel;
