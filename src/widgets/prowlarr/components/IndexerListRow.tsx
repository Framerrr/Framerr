import React from 'react';
import { Loader2, TestTube2 } from 'lucide-react';
import { StatusDot, type MonitorStatus } from '@/shared/ui';
import type { ProwlarrIndexerHealth } from '../prowlarr.types';
import IndexerDetailPopover from './IndexerDetailPopover';

interface IndexerListRowProps {
    indexer: ProwlarrIndexerHealth;
    isAdmin: boolean;
    togglingIndexerId: number | null;
    testingIndexerId: number | null;
    onToggleEnabled: (indexerId: number, enabled: boolean) => Promise<void>;
    onTestIndexer: (indexerId: number) => Promise<void>;
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

const IndexerListRow: React.FC<IndexerListRowProps> = ({
    indexer,
    isAdmin,
    togglingIndexerId,
    testingIndexerId,
    onToggleEnabled,
    onTestIndexer,
}) => {
    const isDisabledRow = indexer.status === 'disabled';
    const isTesting = testingIndexerId === indexer.id;

    return (
        <div className={`prwl-list-row ${isDisabledRow ? 'prwl-list-row--disabled' : ''}`}>
            <IndexerDetailPopover
                indexer={indexer}
                isAdmin={isAdmin}
                togglingIndexerId={togglingIndexerId}
                onToggleEnabled={onToggleEnabled}
            >
                <button type="button" className="prwl-list-row-hit">
                    <StatusDot status={mapStatus(indexer.status)} size="sm" />
                    <div className="prwl-list-row-main">
                        <span className="prwl-list-row-title">{indexer.name}</span>
                        <span className="prwl-list-row-meta">
                            {indexer.protocol} · {indexer.privacy}
                            <span className="prwl-list-row-prio">prio {indexer.priority}</span>
                        </span>
                    </div>
                    {indexer.cloudflareSuspected && <span className="prwl-cf-badge">CF</span>}
                </button>
            </IndexerDetailPopover>

            {isAdmin && (
                <button
                    type="button"
                    className={`prwl-row-test ${isTesting ? 'is-loading' : ''}`}
                    title={`Test ${indexer.name}`}
                    aria-label={`Test ${indexer.name}`}
                    disabled={isTesting || togglingIndexerId === indexer.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        void onTestIndexer(indexer.id);
                    }}
                >
                    {isTesting ? <Loader2 size={13} className="prwl-test-all-spinner" /> : <TestTube2 size={13} />}
                </button>
            )}
        </div>
    );
};

export default IndexerListRow;
