/**
 * Downloads Widget - Shared Types
 *
 * Types shared across widget components.
 */

// ============================================================================
// QBITTORRENT TORRENT (from SSE data)
// ============================================================================

export interface Torrent {
    hash: string;
    name: string;
    state: string;
    progress: number;
    size: number;
    total_size: number;
    dlspeed: number;
    upspeed: number;
    eta: number;
    ratio: number;
    added_on: number;
    completion_on: number;
    category: string;
    tags: string;
    tracker: string;
    num_seeds: number;
    num_leechs: number;
    dl_limit: number;
    up_limit: number;
    save_path: string;
    time_active: number;
    uploaded: number;
    downloaded: number;
    availability: number;
    priority: number;
    [key: string]: unknown;
}
