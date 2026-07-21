/**
 * queueSeverity - shared 5-state download-queue severity resolver.
 *
 * Extracted from Sonarr's original `getQueueBadge()` (the richer of the two
 * widgets' queue-status logic) so both Sonarr and Radarr's Needs Attention
 * rows render the same severities from the same contract. Colors intentionally
 * use the app's semantic theme tokens (--error/--warning/--info/--text-secondary)
 * rather than the theme-invariant media-type tokens, since these describe
 * *pipeline status*, not *release type*. `downloading` is the one exception —
 * it keeps `--digital` to match Radarr's already-shipped downloading stripe.
 */

export type QueueSeverity = 'error' | 'warning' | 'importing' | 'downloading' | 'queued';

export interface QueueSeverityInfo {
    severity: QueueSeverity;
    label: string;
    /** Ready-to-use CSS value, e.g. 'var(--error)'. */
    color: string;
    /** Only true for 'downloading' — callers should render the live progress bar only in this case. */
    showProgress: boolean;
}

interface QueueLikeItem {
    status: string;
    trackedDownloadStatus?: string;
    trackedDownloadState?: string;
}

export function resolveQueueSeverity(item: QueueLikeItem): QueueSeverityInfo {
    if (item.trackedDownloadStatus === 'error' || item.status === 'failed') {
        return { severity: 'error', label: 'Error', color: 'var(--error)', showProgress: false };
    }
    if (item.trackedDownloadStatus === 'warning') {
        return { severity: 'warning', label: 'Warning', color: 'var(--warning)', showProgress: false };
    }
    if (item.trackedDownloadState === 'importing' || item.trackedDownloadState === 'importPending') {
        return { severity: 'importing', label: 'Importing', color: 'var(--info)', showProgress: false };
    }
    if (item.status === 'downloading') {
        return { severity: 'downloading', label: 'Downloading', color: 'var(--digital)', showProgress: true };
    }
    return {
        severity: 'queued',
        label: item.status === 'delay' || item.status === 'queued' ? 'Queued' : 'In Queue',
        color: 'var(--text-secondary)',
        showProgress: false,
    };
}
