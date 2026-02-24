/**
 * LibrarySyncSection - Shared component for library sync UI
 * 
 * Used in Plex, Jellyfin, and Emby integration forms.
 * Provides toggle, progress bar, sync status, and sync now button.
 */

import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Loader, RefreshCw, Database } from 'lucide-react';
import { Switch, Button } from '../../shared/ui';

/** Sync status from library sync service */
export interface SyncStatus {
    syncStatus: 'idle' | 'syncing' | 'error' | 'completed';
    totalItems: number;
    indexedItems: number;
    lastSyncCompleted: string | null;
    errorMessage: string | null;
    phase?: 'fetching' | 'indexing';
    statusMessage?: string;
}

interface LibrarySyncSectionProps {
    /** Whether library sync is enabled */
    enabled: boolean;
    /** Callback when toggle changes */
    onToggle: (checked: boolean) => void;
    /** Whether this is a new integration (not yet saved) */
    isNewIntegration: boolean;
    /** Current sync status */
    syncStatus: SyncStatus | null;
    /** Callback to trigger manual sync */
    onSyncNow: () => void;
}

/**
 * Format relative time from date string
 */
function formatLastSync(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

/** Duration (ms) to show the "Complete" badge before reverting to Sync Now */
const COMPLETE_BADGE_DURATION = 5000;

export const LibrarySyncSection: React.FC<LibrarySyncSectionProps> = ({
    enabled,
    onToggle,
    isNewIntegration,
    syncStatus,
    onSyncNow
}) => {
    // Show green "Complete" badge briefly, then revert to "Sync Now" button
    // Only triggers on a LIVE syncing→completed transition (not on mount with stale 'completed')
    const [showComplete, setShowComplete] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevStatusRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        const currentStatus = syncStatus?.syncStatus;
        const prevStatus = prevStatusRef.current;
        prevStatusRef.current = currentStatus;

        if (currentStatus === 'completed' && prevStatus === 'syncing') {
            // Live transition: user watched it finish → show badge
            setShowComplete(true);
            timerRef.current = setTimeout(() => setShowComplete(false), COMPLETE_BADGE_DURATION);
        } else if (currentStatus !== 'completed') {
            setShowComplete(false);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [syncStatus?.syncStatus]);
    return (
        <div className="p-3 rounded-lg border border-theme bg-theme-hover">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 relative z-10">
                        <Switch
                            checked={enabled}
                            onCheckedChange={onToggle}
                            aria-label="Enable Library Sync"
                        />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-theme-primary flex items-center gap-2">
                            <Database size={14} />
                            Enable Library Sync
                        </p>
                        <p className="text-xs text-theme-secondary mt-0.5">
                            {isNewIntegration
                                ? 'Sync begins automatically when saved'
                                : 'Index your media library for instant search'
                            }
                        </p>

                        {/* Sync status for existing integrations */}
                        {!isNewIntegration && enabled && syncStatus && (
                            <div className="mt-2 text-xs">
                                {syncStatus.syncStatus === 'syncing' ? (
                                    <div className="space-y-1.5">
                                        {/* Progress bar */}
                                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                                            {syncStatus.phase === 'fetching' ? (
                                                // Indeterminate pulsing bar during fetch phase
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: '40%',
                                                        background: 'linear-gradient(90deg, var(--info), var(--accent))',
                                                        animation: 'library-sync-pulse 1.5s ease-in-out infinite'
                                                    }}
                                                />
                                            ) : (
                                                // Determinate bar during indexing phase
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{
                                                        width: syncStatus.totalItems > 0
                                                            ? `${Math.round((syncStatus.indexedItems / syncStatus.totalItems) * 100)}%`
                                                            : '0%',
                                                        background: 'linear-gradient(90deg, var(--info), var(--accent))'
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <span className="text-accent flex items-center gap-1.5">
                                            <Loader size={12} className="animate-spin" />
                                            {syncStatus.statusMessage
                                                ? syncStatus.statusMessage
                                                : syncStatus.totalItems > 0
                                                    ? `Syncing... ${syncStatus.indexedItems.toLocaleString()}/${syncStatus.totalItems.toLocaleString()} items`
                                                    : 'Starting sync...'
                                            }
                                        </span>
                                    </div>
                                ) : syncStatus.syncStatus === 'completed' ? (
                                    <span className="text-success flex items-center gap-1.5">
                                        <CheckCircle2 size={12} />
                                        Sync complete • {syncStatus.indexedItems.toLocaleString()} items indexed
                                    </span>
                                ) : syncStatus.syncStatus === 'error' ? (
                                    <span className="text-error flex items-center gap-1.5">
                                        <AlertCircle size={12} />
                                        Error: {syncStatus.errorMessage || 'Sync failed'}
                                    </span>
                                ) : syncStatus.lastSyncCompleted ? (
                                    <span className="text-theme-secondary flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                                        Last synced: {formatLastSync(syncStatus.lastSyncCompleted)} • {syncStatus.indexedItems.toLocaleString()} items
                                    </span>
                                ) : (
                                    <span className="text-theme-tertiary">Not yet synced</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sync Now button - only for existing integrations with sync enabled */}
                {!isNewIntegration && enabled && (
                    showComplete ? (
                        <div className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-success/20 text-success border border-success/30">
                            <CheckCircle2 size={14} />
                            Complete
                        </div>
                    ) : (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={onSyncNow}
                            loading={syncStatus?.syncStatus === 'syncing'}
                            icon={RefreshCw}
                        >
                            {syncStatus?.syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
                        </Button>
                    )
                )}
            </div>
        </div>
    );
};

export default LibrarySyncSection;
