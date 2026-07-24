/**
 * qBittorrent Poller
 * 
 * Polls qBittorrent torrent list and transfer stats for real-time widget updates.
 * 
 * Auth is handled entirely by the adapter's cookie lifecycle.
 * The poller just calls adapter.get() — no auth code needed here.
 */

import { PluginInstance, PluginAdapter } from '../types';
import logger from '../../utils/logger';

// ============================================================================
// QBITTORRENT POLLER
// ============================================================================

/** Polling interval in milliseconds (5 seconds) */
export const intervalMs = 5000;

/** qBittorrent data shape for SSE */
export interface QBittorrentData {
    torrents: {
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
        num_seeds: number;
        num_leechs: number;
        downloaded: number;
        uploaded: number;
        time_active: number;
    }[];
    transferInfo: {
        dl_info_speed?: number;
        dl_info_data?: number;
        alltime_dl?: number;
        up_info_speed?: number;
        up_info_data?: number;
        alltime_ul?: number;
    } | null;
}

// ============================================================================
// POLL FUNCTION
// ============================================================================

/**
 * Poll qBittorrent for torrents and transfer info.
 */
export async function poll(instance: PluginInstance, adapter?: PluginAdapter): Promise<QBittorrentData> {
    if (!instance.config.url) {
        throw new Error('No URL configured');
    }
    if (!adapter) {
        throw new Error('Adapter required for qBittorrent polling');
    }

    // Fetch torrents list — errors propagate to orchestrator
    const torrentsResponse = await adapter.get!(instance, '/api/v2/torrents/info', {
        timeout: 10000,
    });

    // If we get HTML back, auth failed (cookie expired or invalid)
    if (typeof torrentsResponse.data === 'string' && torrentsResponse.data.startsWith('<')) {
        throw new Error('Authentication failed — session expired');
    }

    const torrents = (Array.isArray(torrentsResponse.data) ? torrentsResponse.data : [])
        .map((t: Record<string, unknown>) => ({
            hash: t.hash as string,
            name: t.name as string,
            state: t.state as string,
            progress: Number(t.progress) || 0,
            size: Number(t.size) || 0,
            total_size: Number(t.total_size) || 0,
            dlspeed: Number(t.dlspeed) || 0,
            upspeed: Number(t.upspeed) || 0,
            eta: Number(t.eta) || 0,
            // qBittorrent returns share ratio as `ratio` on /torrents/info
            ratio: typeof t.ratio === 'number' ? t.ratio : Number(t.ratio) || 0,
            added_on: Number(t.added_on) || 0,
            completion_on: Number(t.completion_on) || 0,
            category: typeof t.category === 'string' ? t.category : '',
            num_seeds: Number(t.num_seeds) || 0,
            num_leechs: Number(t.num_leechs) || 0,
            downloaded: Number(t.downloaded) || 0,
            uploaded: Number(t.uploaded) || 0,
            time_active: Number(t.time_active) || 0,
        }));

    // Fetch transfer info (best effort — keep inner try/catch)
    let transferInfo: QBittorrentData['transferInfo'] = null;
    try {
        const transferResponse = await adapter.get!(instance, '/api/v2/sync/maindata', {
            timeout: 10000,
        });
        const serverState = transferResponse.data?.server_state || transferResponse.data || {};
        transferInfo = {
            dl_info_speed: serverState.dl_info_speed,
            dl_info_data: serverState.dl_info_data,
            alltime_dl: serverState.alltime_dl,
            up_info_speed: serverState.up_info_speed,
            up_info_data: serverState.up_info_data,
            alltime_ul: serverState.alltime_ul
        };
    } catch {
        // Transfer info is optional — don't fail the poll
        logger.debug('[Poller:qbittorrent] Transfer info fetch failed (non-fatal)');
    }

    return { torrents, transferInfo };
}
