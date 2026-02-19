/**
 * SABnzbd Poller
 * 
 * Polls SABnzbd queue and history for real-time widget updates.
 * 
 * SABnzbd API endpoints:
 * - GET /api?mode=queue&output=json&apikey=KEY  → Active downloads
 * - GET /api?mode=history&output=json&apikey=KEY&limit=20 → Completed/failed
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';

// ============================================================================
// SABNZBD POLLER
// ============================================================================

/** Polling interval in milliseconds (5 seconds, same as qBittorrent) */
export const intervalMs = 5000;

// ----------------------------------------------------------------------------
// SABnzbd API response types (from official API docs)
// ----------------------------------------------------------------------------

/** A single item in the SABnzbd queue */
export interface SABnzbdQueueSlot {
    status: string;         // 'Downloading', 'Paused', 'Queued', 'Fetching', 'Propagating',
    // 'Verifying', 'Repairing', 'Extracting', 'Moving', 'Running'
    filename: string;       // Display name
    mb: string;             // Total size in MB (string)
    mbleft: string;         // Remaining size in MB (string)
    percentage: string;     // Progress 0–100 (string)
    timeleft: string;       // ETA as "H:MM:SS" or "0:00:00"
    cat: string;            // Category
    priority: string;       // 'Low', 'Normal', 'High', 'Force'
    nzo_id: string;         // Unique identifier
    labels: string[];       // Warning labels (DUPLICATE, ENCRYPTED, etc.)
    script: string;         // Post-processing script name
    avg_age: string;        // Average age of articles
}

/** A single item in the SABnzbd history */
export interface SABnzbdHistorySlot {
    status: string;         // 'Completed', 'Failed', 'Queued', etc.
    name: string;           // Display name
    bytes: number;          // Total size in bytes
    download_time: number;  // Time to download in seconds
    completed: number;      // Unix timestamp when completed
    category: string;       // Category
    fail_message: string;   // Error message if failed
    nzo_id: string;         // Unique identifier
    storage: string;        // Final storage path
}

/** SABnzbd queue API response */
export interface SABnzbdQueueResponse {
    queue: {
        status: string;         // 'Downloading', 'Paused', 'Idle'
        speed: string;          // Current speed like "15.2 M"
        kbpersec: string;       // Speed in KB/s (string)
        mbleft: string;         // Total remaining MB
        mb: string;             // Total queue size MB
        noofslots_total: number;
        slots: SABnzbdQueueSlot[];
        paused: boolean;        // Global pause state
        speedlimit: string;     // Speed limit in KB/s or percentage
    };
}

/** SABnzbd history API response */
export interface SABnzbdHistoryResponse {
    history: {
        noofslots: number;
        slots: SABnzbdHistorySlot[];
    };
}

/** Combined data shape for SSE */
export interface SABnzbdData {
    queue: SABnzbdQueueSlot[];
    history: SABnzbdHistorySlot[];
    queueInfo: {
        status: string;
        speed: number;          // bytes/s
        totalMb: number;        // total queue size in MB
        remainingMb: number;    // remaining queue size in MB
        paused: boolean;
        speedlimit: string;
        totalSlots: number;
    } | null;
}

/**
 * Poll SABnzbd for queue and history data.
 */
export async function poll(instance: PluginInstance): Promise<SABnzbdData | null> {
    if (!instance.config.url || !instance.config.apiKey) {
        return null;
    }

    const url = translateHostUrl((instance.config.url as string).replace(/\/$/, ''));
    const apiKey = instance.config.apiKey as string;

    try {
        // Fetch queue and history in parallel
        const [queueRes, historyRes] = await Promise.all([
            axios.get<SABnzbdQueueResponse>(`${url}/api`, {
                params: { mode: 'queue', output: 'json', apikey: apiKey },
                httpsAgent,
                timeout: 10000,
            }),
            axios.get<SABnzbdHistoryResponse>(`${url}/api`, {
                params: { mode: 'history', output: 'json', apikey: apiKey, limit: 20 },
                httpsAgent,
                timeout: 10000,
            }),
        ]);

        const queue = queueRes.data?.queue;
        const history = historyRes.data?.history;

        return {
            queue: queue?.slots || [],
            history: history?.slots || [],
            queueInfo: queue ? {
                status: queue.status,
                speed: parseFloat(queue.kbpersec || '0') * 1024,
                totalMb: parseFloat(queue.mb || '0'),
                remainingMb: parseFloat(queue.mbleft || '0'),
                paused: queue.paused ?? false,
                speedlimit: queue.speedlimit || '',
                totalSlots: queue.noofslots_total || 0,
            } : null,
        };
    } catch {
        return null;
    }
}
