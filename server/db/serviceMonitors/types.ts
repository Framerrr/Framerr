/**
 * Service Monitor Types
 * 
 * Type definitions for service monitoring (First-Party and Uptime Kuma).
 */

// ============================================================================
// Public Type Definitions
// ============================================================================

export type MonitorType = 'http' | 'tcp' | 'ping';
export type MonitorStatus = 'up' | 'down' | 'degraded' | 'maintenance' | 'pending';

// Scheduled maintenance window configuration
export interface MaintenanceSchedule {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    startTime: string;    // "02:00" (24h format)
    endTime: string;      // "04:00" (24h format)
    weeklyDays?: number[]; // 0=Sun, 6=Sat (for weekly)
    monthlyDay?: number;   // 1-31 (for monthly, clamped to valid days)
}

export interface ServiceMonitor {
    id: string;
    ownerId: string;
    name: string;
    iconId: string | null;
    iconName: string | null; // Lucide icon name (e.g., 'Globe')
    type: MonitorType;
    url: string | null;
    port: number | null;
    intervalSeconds: number;
    timeoutSeconds: number;
    retries: number;
    degradedThresholdMs: number;
    expectedStatusCodes: string[];
    enabled: boolean;
    maintenance: boolean;
    uptimeKumaId: number | null;
    uptimeKumaUrl: string | null;
    isReadonly: boolean;
    orderIndex: number;
    notifyDown: boolean;
    notifyUp: boolean;
    notifyDegraded: boolean;
    maintenanceSchedule: MaintenanceSchedule | null;
    integrationInstanceId: string | null; // Links to framerr-monitoring integration instance
    sourceIntegrationId: string | null; // Links to the source integration this was imported from (e.g., Plex instance)
    createdAt: string;
    updatedAt: string;
}

export interface MonitorCheckResult {
    status: 'up' | 'down' | 'degraded';
    responseTimeMs: number | null;
    statusCode: number | null;
    errorMessage: string | null;
}

export interface MonitorHistoryEntry {
    id: string;
    monitorId: string;
    status: string;
    responseTimeMs: number | null;
    statusCode: number | null;
    errorMessage: string | null;
    checkedAt: string;
}

export interface MonitorAggregate {
    hourStart: string;
    checksTotal: number;
    checksUp: number;
    checksDegraded: number;
    checksDown: number;
    checksMaintenance: number;
    avgResponseMs: number | null;
}

export interface MonitorShare {
    id: string;
    monitorId: string;
    userId: string;
    notify: boolean;
    createdAt: string;
}

export interface CreateMonitorData {
    name: string;
    iconId?: string | null;
    iconName?: string | null; // Lucide icon name (e.g., 'Globe')
    type?: MonitorType;
    url?: string | null;
    port?: number | null;
    intervalSeconds?: number;
    timeoutSeconds?: number;
    retries?: number;
    degradedThresholdMs?: number;
    expectedStatusCodes?: string[] | string;
    enabled?: boolean;
    uptimeKumaId?: number | null;
    uptimeKumaUrl?: string | null;
    isReadonly?: boolean;
    orderIndex?: number;
    notifyDown?: boolean;
    notifyUp?: boolean;
    notifyDegraded?: boolean;
    maintenanceSchedule?: MaintenanceSchedule | null;
    integrationInstanceId?: string | null;
    sourceIntegrationId?: string | null;
}

// ============================================================================
// Row Types (Internal)
// ============================================================================

export interface MonitorRow {
    id: string;
    owner_id: string;
    name: string;
    icon_id: string | null;
    icon_name: string | null;
    type: string;
    url: string | null;
    port: number | null;
    interval_seconds: number;
    timeout_seconds: number;
    retries: number;
    degraded_threshold_ms: number;
    expected_status_codes: string;
    enabled: number;
    maintenance: number;
    uptime_kuma_id: number | null;
    uptime_kuma_url: string | null;
    is_readonly: number;
    order_index: number;
    notify_down: number;
    notify_up: number;
    notify_degraded: number;
    maintenance_schedule: string | null;
    integration_instance_id: string | null;
    source_integration_id: string | null;
    created_at: number;
    updated_at: number;
}

export interface HistoryRow {
    id: string;
    monitor_id: string;
    status: string;
    response_time_ms: number | null;
    status_code: number | null;
    error_message: string | null;
    checked_at: number;
}

export interface AggregateRow {
    hour_start: number;
    checks_total: number;
    checks_up: number;
    checks_degraded: number;
    checks_down: number;
    checks_maintenance: number;
    avg_response_ms: number | null;
}

export interface ShareRow {
    id: string;
    monitor_id: string;
    user_id: string;
    notify: number;
    created_at: number;
}
