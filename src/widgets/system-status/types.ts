/**
 * System Status Widget Types
 */

import type { WidgetProps } from '../types';

/** Per-disk information from Unraid array */
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

export interface StatusData {
    cpu: number | null;
    memory: number | null;
    temperature: number | null;
    uptime: string | null;
    /** Aggregate disk/array usage percentage (0-100) */
    diskUsage: number | null;
    /** Array health status string (Unraid only, e.g. 'healthy', 'syncing') */
    arrayStatus: string | null;
    /** Network upload speed in bytes/sec */
    networkUp: number | null;
    /** Network download speed in bytes/sec */
    networkDown: number | null;
    /** Per-disk details (Unraid only) */
    disks: DiskInfo[];
}

// Extends canonical WidgetProps
export interface SystemStatusWidgetProps extends WidgetProps {
    // No additional props needed
}

