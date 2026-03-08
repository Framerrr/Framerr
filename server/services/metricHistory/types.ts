/**
 * Metric History — Shared Types and Constants
 *
 * Shared interfaces, constants, and utility functions used across
 * the metric history module.
 *
 * @module server/services/metricHistory/types
 */

import { getPlugin, plugins } from '../../integrations/registry';
import type { MetricDefinition } from '../../integrations/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Resolution for raw data points: 15 seconds */
export const RAW_RESOLUTION_MS = 15_000;

/** Default retention in days if not configured per-integration */
export const DEFAULT_RETENTION_DAYS = 3;

/** Maximum retention allowed */
export const MAX_RETENTION_DAYS = 30;

// ============================================================================
// TYPES
// ============================================================================

export interface MetricBuffer {
    values: number[];
    lastFlush: number;
}

export interface HistoryDataPoint {
    t: number;
    v?: number;
    avg?: number;
    min?: number;
    max?: number;
}

export interface HistoryResponse {
    data: HistoryDataPoint[];
    availableRange: string;
    resolution: string;
    source: 'internal' | 'external';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the set of system-status integration type IDs from plugins that declare metrics.
 * Replaces the old hardcoded SYSTEM_STATUS_TYPES set.
 */
export function getSystemStatusTypes(): Set<string> {
    const types = new Set<string>();
    for (const p of plugins) {
        if (p.metrics && p.metrics.length > 0) {
            types.add(p.id);
        }
    }
    return types;
}

/**
 * Get recordable metric keys for a given integration type from the plugin declaration.
 * Replaces the old hardcoded METRIC_KEYS_BY_TYPE map.
 */
export function getRecordableMetrics(type: string): MetricDefinition[] {
    const plugin = getPlugin(type);
    if (!plugin?.metrics) return [];
    return plugin.metrics.filter(m => m.recordable);
}
