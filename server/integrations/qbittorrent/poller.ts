/**
 * qBittorrent Poller
 * 
 * Polls qBittorrent torrent list and transfer stats for real-time widget updates.
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';

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
        dlspeed: number;
        upspeed: number;
        added_on: number;
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

/**
 * Poll qBittorrent for torrents and transfer info.
 */
export async function poll(instance: PluginInstance): Promise<QBittorrentData | null> {
    if (!instance.config.url) {
        return null;
    }

    const url = (instance.config.url as string).replace(/\/$/, '');

    try {
        // Fetch torrents list
        const torrentsResponse = await axios.get(`${url}/api/v2/torrents/info`, {
            httpsAgent,
            timeout: 10000,
            withCredentials: true
        });

        const torrents = (Array.isArray(torrentsResponse.data) ? torrentsResponse.data : [])
            .map((t: Record<string, unknown>) => ({
                hash: t.hash as string,
                name: t.name as string,
                state: t.state as string,
                progress: t.progress as number,
                size: t.size as number,
                dlspeed: t.dlspeed as number,
                upspeed: t.upspeed as number,
                added_on: t.added_on as number
            }));

        // Fetch transfer info (best effort)
        let transferInfo: QBittorrentData['transferInfo'] = null;
        try {
            const transferResponse = await axios.get(`${url}/api/v2/sync/maindata`, {
                httpsAgent,
                timeout: 10000,
                withCredentials: true
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
            // Transfer info is optional
        }

        return { torrents, transferInfo };
    } catch {
        return null;
    }
}
