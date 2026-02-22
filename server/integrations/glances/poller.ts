/**
 * Glances Poller
 * 
 * Polls Glances system monitoring data for real-time widget updates.
 * Fetches CPU, memory, temperature, uptime, disk usage, and network I/O.
 * 
 * Uses per-instance caching so that when individual Glances API endpoints
 * fail (timeout/network error), the last known good value is retained
 * instead of broadcasting sentinel defaults that cause UI flashing.
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import logger from '../../utils/logger';

// ============================================================================
// GLANCES POLLER
// ============================================================================

/** Polling interval in milliseconds */
export const intervalMs = 5000;

/** Glances data shape for SSE */
export interface GlancesData {
    cpu: number | null;
    memory: number | null;
    temperature: number | null;
    uptime: string | null;
    diskUsage: number | null;
    networkUp: number | null;
    networkDown: number | null;
}

/**
 * Per-instance cache of last known good values.
 * When individual Glances endpoints fail (timeout, network error),
 * we retain the previous successful value instead of sending defaults
 * like cpu=0 or uptime='--' which cause the UI to flash.
 */
const instanceCache = new Map<string, GlancesData>();

/**
 * Poll Glances for system status.
 */
export async function poll(instance: PluginInstance): Promise<GlancesData> {
    if (!instance.config.url) {
        throw new Error('No URL configured');
    }

    const url = (instance.config.url as string).replace(/\/$/, '');
    const password = instance.config.password as string | undefined;

    // Get cached values to use as fallback for failed endpoints
    const cached = instanceCache.get(instance.id);

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (password) {
        headers['X-Auth'] = password;
    }

    // Fetch all endpoints in parallel
    const [quicklookRes, sensorsRes, uptimeRes, fsRes, networkRes] = await Promise.allSettled([
        axios.get(`${url}/api/4/quicklook`, { headers, httpsAgent, timeout: 10000 }),
        axios.get(`${url}/api/4/sensors`, { headers, httpsAgent, timeout: 10000 }),
        axios.get(`${url}/api/4/uptime`, { headers, httpsAgent, timeout: 10000 }),
        axios.get(`${url}/api/4/fs`, { headers, httpsAgent, timeout: 10000 }),
        axios.get(`${url}/api/4/network`, { headers, httpsAgent, timeout: 10000 }),
    ]);

    // Start with cached values (if available) so failed endpoints retain
    // their last known good value instead of falling back to sentinel defaults
    let cpu = cached?.cpu ?? null;
    let memory = cached?.memory ?? null;
    let uptime = cached?.uptime ?? null;
    let temperature: number | null = cached?.temperature ?? null;
    let diskUsage: number | null = cached?.diskUsage ?? null;
    let networkUp: number | null = cached?.networkUp ?? null;
    let networkDown: number | null = cached?.networkDown ?? null;

    // ================================================================
    // CPU & Memory (from quicklook)
    // ================================================================
    if (quicklookRes.status === 'fulfilled') {
        cpu = Math.round(quicklookRes.value.data.cpu || 0);
        memory = Math.round(quicklookRes.value.data.mem || 0);
    } else if (cached) {
        logger.debug(`[Poller:glances] quicklook failed, using cached values`);
    }

    // ================================================================
    // Temperature (from sensors)
    // ================================================================
    if (sensorsRes.status === 'fulfilled') {
        const sensors = sensorsRes.value.data;
        if (Array.isArray(sensors)) {
            const cpuSensor = sensors.find((s: { label?: string; type?: string }) =>
                s.label?.toLowerCase().includes('cpu') ||
                s.label?.toLowerCase().includes('core') ||
                s.type === 'temperature_core'
            );
            if (cpuSensor && typeof cpuSensor.value === 'number') {
                temperature = Math.round(cpuSensor.value);
            }
        }
    }

    // ================================================================
    // Uptime
    // Glances returns either a string like "2 days, 3:04:12" or "3:04:12"
    // or a number (seconds). Normalize to compact "Xd Yh" / "Xh Ym" format.
    // ================================================================
    if (uptimeRes.status === 'fulfilled') {
        const uptimeData = uptimeRes.value.data;
        if (typeof uptimeData === 'string' && uptimeData.length > 0) {
            // Parse "N days, H:MM:SS" or "H:MM:SS" format
            let totalSeconds = 0;
            const dayMatch = uptimeData.match(/(\d+)\s*day/);
            if (dayMatch) {
                totalSeconds += parseInt(dayMatch[1], 10) * 86400;
            }
            const timeMatch = uptimeData.match(/(\d+):(\d+):(\d+)/);
            if (timeMatch) {
                totalSeconds += parseInt(timeMatch[1], 10) * 3600
                    + parseInt(timeMatch[2], 10) * 60
                    + parseInt(timeMatch[3], 10);
            }
            if (totalSeconds > 0) {
                const days = Math.floor(totalSeconds / 86400);
                const hours = Math.floor((totalSeconds % 86400) / 3600);
                const mins = Math.floor((totalSeconds % 3600) / 60);
                uptime = days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`;
            } else {
                // Fallback: pass through if we can't parse
                uptime = uptimeData;
            }
        } else if (typeof uptimeData === 'number') {
            const seconds = uptimeData;
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            uptime = days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`;
        }
    } else if (cached) {
        logger.debug(`[Poller:glances] uptime failed, using cached value`);
    }

    // ================================================================
    // Disk Usage (from fs — filesystem info)
    // Uses the root "/" mount or the largest filesystem as primary
    // ================================================================
    if (fsRes.status === 'fulfilled') {
        const fsList = fsRes.value.data;
        if (Array.isArray(fsList) && fsList.length > 0) {
            // Prefer root mount, fallback to the largest filesystem
            const rootFs = fsList.find((fs: { mnt_point?: string }) => fs.mnt_point === '/');
            const targetFs = rootFs || fsList.reduce((largest: { size?: number }, fs: { size?: number }) =>
                (fs.size || 0) > (largest.size || 0) ? fs : largest
                , fsList[0]);

            if (targetFs && typeof targetFs.percent === 'number') {
                diskUsage = Math.round(targetFs.percent);
            }
        }
    }

    // ================================================================
    // Network I/O (from network — interface stats)
    // Glances provides rate data directly via bytes_*_rate_per_sec
    // ================================================================
    if (networkRes.status === 'fulfilled') {
        const netList = networkRes.value.data;
        if (Array.isArray(netList) && netList.length > 0) {
            let totalRxRate = 0, totalTxRate = 0;
            for (const iface of netList) {
                const name = (iface.interface_name || '').toLowerCase();
                if (name === 'lo' || name.startsWith('veth') || name.startsWith('br-') || name.startsWith('docker')) {
                    continue; // Skip loopback and Docker virtual interfaces
                }
                totalRxRate += (iface.bytes_recv_rate_per_sec || 0);
                totalTxRate += (iface.bytes_sent_rate_per_sec || 0);
            }
            networkDown = totalRxRate;
            networkUp = totalTxRate;
        }
    } else if (cached) {
        logger.debug(`[Poller:glances] network failed, using cached values`);
    }

    // Total failure detection: if ALL endpoints rejected, don't poison cache
    const allFailed = [quicklookRes, sensorsRes, uptimeRes, fsRes, networkRes]
        .every(r => r.status === 'rejected');

    if (allFailed) {
        throw new Error('All Glances endpoints unreachable');
    }

    const result: GlancesData = { cpu, memory, temperature, uptime, diskUsage, networkUp, networkDown };

    // Only cache when we have at least some real data (not all defaults)
    const hasRealData = !allFailed;
    if (hasRealData) {
        instanceCache.set(instance.id, result);
    }

    return result;
}
