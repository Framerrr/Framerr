/**
 * Service Monitors Database Layer
 * 
 * Barrel export for all service monitor database operations.
 * 
 * Handles CRUD, check recording, sharing, and aggregates for service monitoring.
 */

// ============================================================================
// Re-export all functions from submodules
// ============================================================================

export * from './helpers';
export * from './crud';
export * from './history';
export * from './aggregates';
export * from './shares';

// ============================================================================
// Re-export types for consumers
// ============================================================================

export type {
    MonitorType,
    MonitorStatus,
    MaintenanceSchedule,
    ServiceMonitor,
    MonitorCheckResult,
    MonitorHistoryEntry,
    MonitorAggregate,
    MonitorShare,
    CreateMonitorData,
} from './types';
