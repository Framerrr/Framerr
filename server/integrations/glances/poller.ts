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

import { PluginInstance, PluginAdapter } from '../types';
import logger from '../../utils/logger';

// ============================================================================
// GLANCES POLLER
// ============================================================================

/** Polling interval in milliseconds */
export const intervalMs = 5000;

/** Per-disk information extracted from Glances filesystem data */
export interface GlancesDiskInfo {
    id: string;
    name: string;
    type: 'parity' | 'data' | 'cache';
    temp: number | null;
    status: 'ok' | 'disabled' | 'invalid' | 'missing' | 'new' | 'wrong' | 'not-present';
    fsSize: number | null;
    fsFree: number | null;
    usagePercent: number | null;
}

/** Glances data shape for SSE */
export interface GlancesData {
    cpu: number | null;
    memory: number | null;
    temperature: number | null;
    uptime: string | null;
    diskUsage: number | null;
    networkUp: number | null;
    networkDown: number | null;
    disks: GlancesDiskInfo[];
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
export async function poll(instance: PluginInstance, adapter: PluginAdapter): Promise<GlancesData> {
    // Get cached values to use as fallback for failed endpoints
    const cached = instanceCache.get(instance.id);

    // Fetch all endpoints in parallel
    const [quicklookRes, sensorsRes, uptimeRes, fsRes, networkRes] = await Promise.allSettled([
        adapter.get!(instance, '/api/4/quicklook', { timeout: 10000 }),
        adapter.get!(instance, '/api/4/sensors', { timeout: 10000 }),
        adapter.get!(instance, '/api/4/uptime', { timeout: 10000 }),
        adapter.get!(instance, '/api/4/fs', { timeout: 10000 }),
        adapter.get!(instance, '/api/4/network', { timeout: 10000 }),
    ]);

    // Start with cached values (if available) so failed endpoints retain
    // their last known good value instead of falling back to sentinel defaults
    let cpu = cached?.cpu ?? null;
    let memory = cached?.memory ?? null;
    let uptime = cached?.uptime ?? null;
    let temperature: number | null = cached?.temperature ?? null;
    let diskUsage: number | null = cached?.diskUsage ?? null;
    let disks: GlancesDiskInfo[] = cached?.disks ?? [];
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
            // Priority-based CPU temperature sensor selection.
            // Different platforms use different labels — try most specific first,
            // then fall back to generic patterns.
            const tempSensors = sensors.filter(
                (s: { type?: string }) => s.type === 'temperature_core'
            );

            // Priority 1: AMD CPU sensors (Tctl = control temp, Tccd = die temp, k10temp)
            // Priority 2: Intel CPU sensors (Package id = package temp, coretemp)
            // Priority 3: Generic CPU label
            // Priority 4: First temperature_core sensor (fallback)
            const priorities: Array<(s: { label?: string }) => boolean> = [
                (s) => /^(tctl|tccd|k10temp)/i.test(s.label || ''),
                (s) => /^(package\s*id|coretemp)/i.test(s.label || ''),
                (s) => /cpu/i.test(s.label || ''),
            ];

            let cpuSensor: { value?: number } | undefined;
            for (const matcher of priorities) {
                cpuSensor = tempSensors.find(matcher);
                if (cpuSensor) break;
            }
            // Fallback: first temperature_core sensor
            if (!cpuSensor) cpuSensor = tempSensors[0];

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
    // Filters out noise (Docker overlays, squashfs, tmpfs, tiny mounts)
    // and deduplicates by device_name. Populates per-disk array +
    // aggregate diskUsage as weighted average.
    // ================================================================
    if (fsRes.status === 'fulfilled') {
        const fsList = fsRes.value.data;
        if (Array.isArray(fsList) && fsList.length > 0) {
            const MIN_SIZE = 1_000_000_000; // 1 GB — skip tiny boot/squashfs partitions

            // Step 1: Filter out virtual/noise filesystems
            const realFs = fsList.filter((fs: {
                fs_type?: string;
                mnt_point?: string;
                device_name?: string;
                size?: number;
            }) => {
                const fsType = (fs.fs_type || '').toLowerCase();
                const mount = fs.mnt_point || '';
                const size = fs.size || 0;

                // Exclude virtual filesystem types
                if (/^(squashfs|tmpfs|devtmpfs|overlay|devpts|sysfs|proc|cgroup)$/.test(fsType)) return false;
                // Exclude Docker internal mounts
                if (mount.includes('/docker/btrfs/subvolumes/')) return false;
                // Exclude system pseudo-mounts
                if (/^\/(proc|sys|dev|run)/.test(mount)) return false;
                if (/^\/(etc\/(resolv|hostname|hosts))/.test(mount)) return false;
                // Exclude tiny partitions
                if (size < MIN_SIZE) return false;

                return true;
            });

            // Step 2: Deduplicate by device_name — keep the shortest mount path
            // (e.g. /dev/nvme0n1p1 → keep "/" over "/rootfs/mnt/cache/system/docker/btrfs")
            const byDevice = new Map<string, typeof realFs[0]>();
            for (const fs of realFs) {
                const dev = fs.device_name || fs.mnt_point || '';
                const existing = byDevice.get(dev);
                if (!existing || (fs.mnt_point || '').length < (existing.mnt_point || '').length) {
                    byDevice.set(dev, fs);
                }
            }

            // Step 3: Map to DiskInfo format and sort by mount path
            const filtered = Array.from(byDevice.values()).sort(
                (a, b) => (a.mnt_point || '').localeCompare(b.mnt_point || '')
            );

            disks = filtered.map((fs, idx) => {
                const mount = (fs.mnt_point || '') as string;
                // Derive a clean display name from mount point
                const displayName = mount === '/'
                    ? 'Root'
                    : mount.replace(/^\/rootfs/, '').split('/').filter(Boolean).pop() || `disk${idx}`;

                return {
                    id: `fs-${idx}`,
                    name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
                    type: 'data' as const,
                    temp: null,
                    status: 'ok' as const,
                    fsSize: fs.size || null,
                    fsFree: fs.free || null,
                    usagePercent: typeof fs.percent === 'number' ? Math.round(fs.percent) : null,
                };
            });

            // Step 4: Compute aggregate diskUsage as weighted average
            let totalSize = 0, totalUsed = 0;
            for (const d of disks) {
                if (d.fsSize && d.fsFree) {
                    totalSize += d.fsSize;
                    totalUsed += (d.fsSize - d.fsFree);
                }
            }
            diskUsage = totalSize > 0 ? Math.round((totalUsed / totalSize) * 100) : null;
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

    const result: GlancesData = { cpu, memory, temperature, uptime, diskUsage, networkUp, networkDown, disks };

    // Only cache when we have at least some real data (not all defaults)
    const hasRealData = !allFailed;
    if (hasRealData) {
        instanceCache.set(instance.id, result);
    }

    return result;
}
