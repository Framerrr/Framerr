/**
 * qBittorrent Poller
 * 
 * Polls qBittorrent torrent list and transfer stats for real-time widget updates.
 * 
 * Auth: qBittorrent uses cookie-based auth (not API keys).
 * If username/password are configured, we login to get a SID cookie and
 * attach it to all subsequent requests. Cookie is cached with a 5-minute TTL.
 * If no credentials are configured, requests are made without auth
 * (works when qBittorrent auth is disabled).
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
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

// ============================================================================
// COOKIE AUTH — matches adapter pattern
// ============================================================================

interface CachedCookie {
    sid: string;
    timestamp: number;
}

/** Cached SID cookies per instance ID */
const cookieCache = new Map<string, CachedCookie>();
/** Cookie TTL: 5 minutes */
const COOKIE_TTL_MS = 5 * 60 * 1000;

/**
 * Get auth cookies for a qBittorrent instance.
 * Returns Cookie header string if credentials configured, otherwise empty string.
 * Caches the SID cookie with a 5-minute TTL.
 */
async function getAuthCookies(instance: PluginInstance, baseUrl: string): Promise<string> {
    const username = instance.config.username as string | undefined;
    const password = instance.config.password as string | undefined;

    // No credentials → no auth needed (qBit auth disabled)
    if (!username && !password) {
        return '';
    }

    // Check cache
    const cached = cookieCache.get(instance.id);
    if (cached && Date.now() - cached.timestamp < COOKIE_TTL_MS) {
        return `SID=${cached.sid}`;
    }

    // Login to get fresh SID
    logger.debug(`[Poller:qbittorrent] Logging in: instance=${instance.id}`);
    const loginResponse = await axios.post(
        `${baseUrl}/api/v2/auth/login`,
        `username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}`,
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            httpsAgent,
            timeout: 10000,
        }
    );

    // qBittorrent returns "Ok." on success, "Fails." on bad credentials
    if (loginResponse.data === 'Fails.') {
        // Clear any stale cache
        cookieCache.delete(instance.id);
        throw new Error('Authentication failed — check username/password');
    }

    // Extract SID from Set-Cookie header
    const setCookies = loginResponse.headers['set-cookie'] || [];
    let sid = '';
    for (const cookie of setCookies) {
        const match = cookie.match(/SID=([^;]+)/);
        if (match) {
            sid = match[1];
            break;
        }
    }

    if (!sid) {
        throw new Error('Login succeeded but no SID cookie received');
    }

    cookieCache.set(instance.id, { sid, timestamp: Date.now() });
    logger.debug(`[Poller:qbittorrent] Login successful, SID cached`);
    return `SID=${sid}`;
}

// ============================================================================
// POLL FUNCTION
// ============================================================================

/**
 * Poll qBittorrent for torrents and transfer info.
 */
export async function poll(instance: PluginInstance): Promise<QBittorrentData> {
    if (!instance.config.url) {
        throw new Error('No URL configured');
    }

    const url = (instance.config.url as string).replace(/\/$/, '');
    const baseUrl = translateHostUrl(url);

    // Get auth cookies (empty string if no credentials)
    const cookieHeader = await getAuthCookies(instance, baseUrl);
    const headers: Record<string, string> = {};
    if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
    }

    // Fetch torrents list — errors propagate to orchestrator
    const torrentsResponse = await axios.get(`${baseUrl}/api/v2/torrents/info`, {
        headers,
        httpsAgent,
        timeout: 10000,
    });

    // If we get HTML back, auth failed (cookie expired or invalid)
    if (typeof torrentsResponse.data === 'string' && torrentsResponse.data.startsWith('<')) {
        // Clear cookie cache so next poll re-authenticates
        cookieCache.delete(instance.id);
        throw new Error('Authentication failed — session expired');
    }

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

    // Fetch transfer info (best effort — keep inner try/catch)
    let transferInfo: QBittorrentData['transferInfo'] = null;
    try {
        const transferResponse = await axios.get(`${baseUrl}/api/v2/sync/maindata`, {
            headers,
            httpsAgent,
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
    }

    return { torrents, transferInfo };
}
