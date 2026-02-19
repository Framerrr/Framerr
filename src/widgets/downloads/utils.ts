/**
 * Downloads Widget - Shared Utilities
 *
 * Formatting and state classification helpers used by both
 * qBittorrent and SABnzbd rendering paths.
 */

// ============================================================================
// FORMATTING
// ============================================================================

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1000;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec === 0) return '0 B/s';
    return formatBytes(bytesPerSec) + '/s';
}

export function formatEta(seconds: number): string {
    if (seconds <= 0 || seconds >= 8640000) return '∞';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

/** Format a relative time ago string from a unix timestamp */
export function formatTimeAgo(timestamp: number): string {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

/** Format a download duration in seconds to a readable string */
export function formatDuration(seconds: number): string {
    if (seconds <= 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// ============================================================================
// QBITTORRENT STATE CLASSIFICATION
// ============================================================================

/** Map qBittorrent state string to a normalized status class */
export function getQbtStateClass(state: string): string {
    if (['downloading', 'metaDL', 'forcedDL', 'allocating'].includes(state)) return 'downloading';
    if (['uploading', 'forcedUP', 'stalledUP'].includes(state)) return 'seeding';  // Done, in seeding mode
    if (['pausedUP', 'stoppedUP'].includes(state)) return 'completed';  // Done, user paused — terminal
    if (['pausedDL', 'stoppedDL'].includes(state)) return 'paused';  // Download incomplete, user paused
    if (['stalledDL'].includes(state)) return 'stalled';
    if (['queuedDL', 'queuedUP'].includes(state)) return 'queued';
    if (['checkingDL', 'checkingUP', 'checkingResumeData'].includes(state)) return 'checking';
    if (state === 'moving') return 'moving';
    if (['error', 'missingFiles', 'unknown'].includes(state)) return 'error';
    return 'stalled';
}

/** Human-readable state label for qBittorrent */
export function getQbtStateLabel(state: string): string {
    const cls = getQbtStateClass(state);
    const labels: Record<string, string> = {
        downloading: 'Downloading',
        seeding: 'Seeding',
        completed: 'Completed',
        paused: 'Paused',
        stalled: 'Stalled',
        queued: 'Queued',
        checking: 'Checking',
        moving: 'Moving',
        error: 'Error',
    };
    return labels[cls] || 'Unknown';
}

// ============================================================================
// SABNZBD STATE CLASSIFICATION
// ============================================================================

/** Map SABnzbd status string to a normalized status class */
export function getSabStateClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'downloading') return 'downloading';
    if (s === 'paused') return 'paused';
    if (s === 'queued' || s === 'propagating' || s === 'fetching') return 'queued';
    // Post-processing states → "processing" (uses --accent with pulse)
    if (['verifying', 'repairing', 'extracting', 'moving', 'running'].includes(s)) return 'processing';
    if (s === 'completed') return 'completed';
    if (s === 'failed') return 'error';
    return 'queued';
}

/** Human-readable state label for SABnzbd */
export function getSabStateLabel(status: string): string {
    const cls = getSabStateClass(status);
    const labels: Record<string, string> = {
        downloading: 'Downloading',
        paused: 'Paused',
        queued: 'Queued',
        processing: status, // Show the actual status (Extracting, Verifying, etc.)
        completed: 'Completed',
        error: 'Failed',
    };
    return labels[cls] || status;
}

// ============================================================================
// CLIENT TYPE
// ============================================================================

export type ClientType = 'qbittorrent' | 'sabnzbd';
