/**
 * Metric History — Barrel Export
 *
 * Re-exports key symbols for convenient importing.
 *
 * @module server/services/metricHistory
 */

export type { MetricBuffer, HistoryDataPoint, HistoryResponse } from './types';
export { RAW_RESOLUTION_MS, DEFAULT_RETENTION_DAYS, MAX_RETENTION_DAYS, getSystemStatusTypes, getRecordableMetrics } from './types';
