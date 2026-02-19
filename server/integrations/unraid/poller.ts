/**
 * Unraid Integration - Poller
 *
 * Polls Unraid's GraphQL API for system metrics:
 * - CPU usage, memory usage (from `metrics` query)
 * - Temperature (from `info.cpu.packages.temp`)
 * - Uptime (from `info.os.uptime` — boot time ISO string)
 * - Disk/array usage, array status (from `array` query)
 *
 * Note: Network I/O (upload/download speeds) is NOT available
 * through the Unraid GraphQL query API. The `network` query only
 * exposes access URLs, not traffic counters.
 *
 * Uses a single GraphQL query per poll for efficiency.
 * Schema reference: docs/private/features/UNRAIDAPI.MD
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
import logger from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

/** Per-disk information extracted from the Unraid array */
export interface DiskInfo {
    /** Unique identifier: "parity-0", "disk-1", "cache-0" */
    id: string;
    /** Display name: "Parity", "Disk 1", "Cache" */
    name: string;
    /** Disk role in the array */
    type: 'parity' | 'data' | 'cache';
    /** Temperature in °C (null if disk is spun down or unavailable) */
    temp: number | null;
    /** Mapped status for display */
    status: 'ok' | 'disabled' | 'invalid' | 'missing' | 'new' | 'wrong' | 'not-present';
    /** Total filesystem size in bytes (null for parity disks) */
    fsSize: number | null;
    /** Free filesystem space in bytes (null for parity disks) */
    fsFree: number | null;
    /** Usage percentage 0-100 (null for parity disks) */
    usagePercent: number | null;
}

export interface UnraidData {
    /** CPU usage percentage (0-100) */
    cpu: number | null;
    /** Memory usage percentage (0-100) */
    memory: number | null;
    /** Temperature in °C from CPU package (null if unavailable) */
    temperature: number | null;
    /** System uptime formatted string */
    uptime: string | null;
    /** Disk/array usage percentage (0-100) — aggregate */
    diskUsage: number | null;
    /** Array health status */
    arrayStatus: string | null;
    /** Per-disk details (parities + data disks + caches, excludes flash) */
    disks: DiskInfo[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Poll every 5 seconds */
export const intervalMs = 5000;

/** Fragment for per-disk fields shared across parities, disks, caches */
const DISK_FIELDS = `
    name
    idx
    temp
    status
    type
    fsSize
    fsFree
    fsUsed
`;

/**
 * GraphQL query to fetch all system metrics in a single request.
 *
 * Field paths verified against Unraid 7.2+ GraphQL schema:
 * - metrics.cpu.percentTotal — real-time CPU usage (0-100)
 * - metrics.memory.percentTotal — real-time memory usage (0-100)
 * - info.os.uptime — boot time as ISO string
 * - array.state — array state enum (STARTED, STOPPED, etc.)
 * - array.capacity.kilobytes — free/used/total as string KB values
 * - array.parities/disks/caches — per-disk details
 *
 * Temperature: Not reliably available (depends on hardware).
 * Network I/O: Not available via Unraid GraphQL API.
 */
const SYSTEM_QUERY = `
query SystemStatus {
    metrics {
        cpu {
            percentTotal
        }
        memory {
            percentTotal
        }
    }
    info {
        os {
            uptime
        }
    }
    array {
        state
        capacity {
            kilobytes {
                free
                used
                total
            }
        }
        parities { ${DISK_FIELDS} }
        disks { ${DISK_FIELDS} }
        caches { ${DISK_FIELDS} }
    }
}
`;

// ============================================================================
// DISK STATUS MAPPING
// ============================================================================

/** Map Unraid ArrayDiskStatus enum to display-friendly status */
const DISK_STATUS_MAP: Record<string, DiskInfo['status']> = {
    'DISK_OK': 'ok',
    'DISK_DSBL': 'disabled',
    'DISK_DSBL_NEW': 'disabled',
    'DISK_INVALID': 'invalid',
    'DISK_WRONG': 'wrong',
    'DISK_NP': 'not-present',
    'DISK_NP_DSBL': 'not-present',
    'DISK_NP_MISSING': 'missing',
    'DISK_NEW': 'new',
};

/** Convert a raw Unraid disk object into our DiskInfo type */
function parseDisk(
    raw: Record<string, unknown>,
    role: 'parity' | 'data' | 'cache',
): DiskInfo | null {
    // Skip flash (type === 'Flash') and not-present slots with no device
    const diskType = raw.type as string | undefined;
    if (diskType === 'Flash') return null;

    const name = (raw.name as string) || `${role}-${raw.idx}`;
    const idx = typeof raw.idx === 'number' ? raw.idx : 0;
    const id = `${role}-${idx}`;

    // Temperature: NaN/-1 means unavailable (spun down or no sensor)
    const rawTemp = raw.temp as number | undefined;
    const temp = (typeof rawTemp === 'number' && !isNaN(rawTemp) && rawTemp > 0)
        ? rawTemp
        : null;

    // Status mapping
    const rawStatus = raw.status as string | undefined;
    const status = (rawStatus && DISK_STATUS_MAP[rawStatus]) || 'ok';

    // Filesystem sizes are in KB (BigInt serialized as string or number)
    const fsSizeKb = parseFloat(String(raw.fsSize ?? ''));
    const fsFreeKb = parseFloat(String(raw.fsFree ?? ''));

    const fsSize = !isNaN(fsSizeKb) && fsSizeKb > 0 ? fsSizeKb * 1024 : null;
    const fsFree = !isNaN(fsFreeKb) && fsFreeKb >= 0 ? fsFreeKb * 1024 : null;

    let usagePercent: number | null = null;
    if (fsSize !== null && fsFree !== null && fsSize > 0) {
        usagePercent = Math.round(((fsSize - fsFree) / fsSize) * 100);
    }

    return { id, name, type: role, temp, status, fsSize, fsFree, usagePercent };
}

// ============================================================================
// UPTIME FORMATTING
// ============================================================================

/**
 * Format uptime from an ISO boot-time string into a human-readable duration.
 *
 * The Unraid API returns `info.os.uptime` as a boot-time ISO string
 * (e.g. "2025-02-10T08:30:00.000Z"), not as seconds.
 * We calculate the elapsed time since boot.
 */
function formatUptime(uptimeValue: unknown): string | null {
    if (uptimeValue == null) return null;

    if (typeof uptimeValue === 'string' && uptimeValue.length > 0) {
        // Try to parse as ISO date (boot time)
        const bootTime = new Date(uptimeValue);
        if (!isNaN(bootTime.getTime())) {
            const now = Date.now();
            const elapsedMs = now - bootTime.getTime();
            if (elapsedMs < 0) return null; // Boot time in the future — clock issue

            const totalSeconds = Math.floor(elapsedMs / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);

            if (days > 0) return `${days}d ${hours}h`;
            if (hours > 0) return `${hours}h ${minutes}m`;
            return `${minutes}m`;
        }

        // Not a valid ISO date — return as-is if it looks like a pre-formatted string
        return uptimeValue;
    }

    // Fallback: if it's a number (seconds), handle it
    if (typeof uptimeValue === 'number') {
        const totalSeconds = Math.floor(uptimeValue);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    return null;
}

// ============================================================================
// POLL FUNCTION
// ============================================================================

export async function poll(instance: PluginInstance): Promise<UnraidData | null> {
    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) return null;

    const translatedUrl = translateHostUrl(url);

    try {
        const response = await axios.post(
            `${translatedUrl}/graphql`,
            { query: SYSTEM_QUERY },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                },
                httpsAgent,
                timeout: 10000,
            }
        );

        // Log GraphQL-level errors (these return 200 status but contain errors)
        if (response.data?.errors?.length) {
            const errMsg = response.data.errors.map((e: { message?: string }) => e.message).join('; ');
            logger.warn(`[Poller:unraid] GraphQL errors: ${errMsg}`);
        }

        const data = response.data?.data;
        if (!data) {
            logger.warn(`[Poller:unraid] No data in response`);
            return null;
        }

        // ================================================================
        // EXTRACT REAL-TIME METRICS (from `metrics` query)
        // ================================================================

        // CPU usage — metrics.cpu.percentTotal is a Float (0-100)
        const cpu = typeof data.metrics?.cpu?.percentTotal === 'number'
            ? Math.round(data.metrics.cpu.percentTotal)
            : null;

        // Memory usage — metrics.memory.percentTotal is a Float (0-100)
        const memory = typeof data.metrics?.memory?.percentTotal === 'number'
            ? Math.round(data.metrics.memory.percentTotal)
            : null;

        // ================================================================
        // EXTRACT STATIC INFO (from `info` query)
        // ================================================================

        // Temperature — Not reliably available via Unraid GraphQL API
        // info.cpu.packages.temp exists in schema but depends on hardware support
        // Array disk temps are per-disk, not system temp
        const temperature: number | null = null;

        // Uptime — info.os.uptime is a boot-time ISO string
        const uptime = formatUptime(data.info?.os?.uptime);

        // ================================================================
        // EXTRACT ARRAY METRICS (from `array` query)
        // ================================================================

        let diskUsage: number | null = null;
        let arrayStatus: string | null = null;

        if (data.array) {
            // Array state: STARTED, STOPPED, etc.
            const rawState = data.array.state;
            if (typeof rawState === 'string') {
                const stateMap: Record<string, string> = {
                    'STARTED': 'healthy',
                    'STOPPED': 'stopped',
                    'NEW_ARRAY': 'new',
                    'RECON_DISK': 'rebuilding',
                    'DISABLE_DISK': 'degraded',
                    'SWAP_DSBL': 'degraded',
                    'INVALID_EXPANSION': 'error',
                    'PARITY_NOT_BIGGEST': 'error',
                    'TOO_MANY_MISSING_DISKS': 'degraded',
                    'NEW_DISK_TOO_SMALL': 'error',
                    'NO_DATA_DISKS': 'error',
                };
                arrayStatus = stateMap[rawState] || rawState.toLowerCase();
            }

            // Capacity — array.capacity.kilobytes has free/used/total as String!
            // Values are in kilobytes
            const kb = data.array.capacity?.kilobytes;
            if (kb) {
                const totalKb = parseFloat(kb.total);
                const usedKb = parseFloat(kb.used);
                if (!isNaN(totalKb) && totalKb > 0 && !isNaN(usedKb)) {
                    diskUsage = Math.round((usedKb / totalKb) * 100);
                } else {
                    // Fallback: calculate used from total - free
                    const freeKb = parseFloat(kb.free);
                    if (!isNaN(totalKb) && totalKb > 0 && !isNaN(freeKb)) {
                        diskUsage = Math.round(((totalKb - freeKb) / totalKb) * 100);
                    }
                }
            }
        }

        // ================================================================
        // EXTRACT PER-DISK DETAILS
        // ================================================================

        const disks: DiskInfo[] = [];
        if (data.array) {
            // Parities
            const rawParities = data.array.parities as Record<string, unknown>[] | undefined;
            if (Array.isArray(rawParities)) {
                for (const raw of rawParities) {
                    const disk = parseDisk(raw, 'parity');
                    if (disk) disks.push(disk);
                }
            }
            // Data disks
            const rawDisks = data.array.disks as Record<string, unknown>[] | undefined;
            if (Array.isArray(rawDisks)) {
                for (const raw of rawDisks) {
                    const disk = parseDisk(raw, 'data');
                    if (disk) disks.push(disk);
                }
            }
            // Cache disks
            const rawCaches = data.array.caches as Record<string, unknown>[] | undefined;
            if (Array.isArray(rawCaches)) {
                for (const raw of rawCaches) {
                    const disk = parseDisk(raw, 'cache');
                    if (disk) disks.push(disk);
                }
            }
        }

        const result: UnraidData = {
            cpu,
            memory,
            temperature,
            uptime,
            diskUsage,
            arrayStatus,
            disks,
        };

        logger.debug(`[Poller:unraid] Poll result: cpu=${cpu} mem=${memory} temp=${temperature} uptime=${uptime} disk=${diskUsage} array=${arrayStatus} disks=${disks.length}`);

        return result;
    } catch (error) {
        const err = error as { message?: string; response?: { status?: number } };
        logger.warn(`[Poller:unraid] Poll failed: ${err.message}${err.response?.status ? ` (HTTP ${err.response.status})` : ''}`);
        return null;
    }
}
