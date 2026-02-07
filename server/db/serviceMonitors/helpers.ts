/**
 * Service Monitor Helpers
 * 
 * Row converters for transforming database rows to domain objects.
 */

import type {
    MonitorRow,
    HistoryRow,
    AggregateRow,
    ShareRow,
    ServiceMonitor,
    MonitorHistoryEntry,
    MonitorAggregate,
    MonitorShare,
    MonitorType,
} from './types';

// ============================================================================
// Row Converters
// ============================================================================

export function rowToMonitor(row: MonitorRow): ServiceMonitor {
    let expectedStatusCodes: string[] = ['200-299'];
    try {
        expectedStatusCodes = JSON.parse(row.expected_status_codes);
    } catch {
        // Keep default
    }

    return {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        iconId: row.icon_id,
        iconName: row.icon_name,
        type: row.type as MonitorType,
        url: row.url,
        port: row.port,
        intervalSeconds: row.interval_seconds,
        timeoutSeconds: row.timeout_seconds,
        retries: row.retries,
        degradedThresholdMs: row.degraded_threshold_ms,
        expectedStatusCodes,
        enabled: row.enabled === 1,
        maintenance: row.maintenance === 1,
        uptimeKumaId: row.uptime_kuma_id,
        uptimeKumaUrl: row.uptime_kuma_url,
        isReadonly: row.is_readonly === 1,
        orderIndex: row.order_index,
        notifyDown: row.notify_down === 1,
        notifyUp: row.notify_up === 1,
        notifyDegraded: row.notify_degraded === 1,
        maintenanceSchedule: row.maintenance_schedule ? JSON.parse(row.maintenance_schedule) : null,
        integrationInstanceId: row.integration_instance_id,
        sourceIntegrationId: row.source_integration_id,
        createdAt: new Date(row.created_at * 1000).toISOString(),
        updatedAt: new Date(row.updated_at * 1000).toISOString(),
    };
}

export function rowToHistory(row: HistoryRow): MonitorHistoryEntry {
    return {
        id: row.id,
        monitorId: row.monitor_id,
        status: row.status,
        responseTimeMs: row.response_time_ms,
        statusCode: row.status_code,
        errorMessage: row.error_message,
        checkedAt: new Date(row.checked_at * 1000).toISOString(),
    };
}

export function rowToAggregate(row: AggregateRow): MonitorAggregate {
    return {
        hourStart: new Date(row.hour_start * 1000).toISOString(),
        checksTotal: row.checks_total,
        checksUp: row.checks_up,
        checksDegraded: row.checks_degraded,
        checksDown: row.checks_down,
        checksMaintenance: row.checks_maintenance || 0,
        avgResponseMs: row.avg_response_ms,
    };
}

export function rowToShare(row: ShareRow): MonitorShare {
    return {
        id: row.id,
        monitorId: row.monitor_id,
        userId: row.user_id,
        notify: row.notify === 1,
        createdAt: new Date(row.created_at * 1000).toISOString(),
    };
}
