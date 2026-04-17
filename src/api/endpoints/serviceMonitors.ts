/**
 * Service Monitor API Endpoints
 * CRUD operations for first-party service monitors
 */
import { api } from '../client';

// ─── Response Types ───────────────────────────────────────────

export interface MonitorListResponse {
    monitors: Record<string, unknown>[];
}

export interface MonitorStatusResponse {
    status: string;
    responseTimeMs: number | null;
}

export interface MonitorTestResponse {
    success: boolean;
    response_time_ms?: number;
    error?: string;
}

export interface MonitorSaveResponse {
    monitor: Record<string, unknown>;
}

// ─── Payload Types ────────────────────────────────────────────

export interface MonitorTestPayload {
    url?: string;
    host?: string;
    port?: number;
    type: string;
    timeout_seconds: number;
    expected_status_codes?: string;
}

export interface MonitorCreatePayload {
    name: string;
    url?: string;
    port?: number;
    type: string;
    iconName?: string;
    enabled: boolean;
    intervalSeconds: number;
    timeoutSeconds: number;
    retries: number;
    degradedThresholdMs?: number;
    expectedStatusCodes?: string;
    maintenanceSchedule?: unknown;
    integrationInstanceId: string;
    sourceIntegrationId?: string | null;
}

export type MonitorUpdatePayload = Omit<MonitorCreatePayload, 'integrationInstanceId' | 'sourceIntegrationId'>;

// ─── Endpoints ────────────────────────────────────────────────

export const serviceMonitorsApi = {
    /**
     * List monitors filtered by integration instance
     */
    list: (instanceId: string) =>
        api.get<MonitorListResponse>(`/api/service-monitors?instanceId=${encodeURIComponent(instanceId)}`),

    /**
     * Get current status for a single monitor
     */
    getStatus: (monitorId: string) =>
        api.get<MonitorStatusResponse>(`/api/service-monitors/${monitorId}/status`),

    /**
     * Test connectivity for a monitor (does not require saved monitor)
     */
    test: (payload: MonitorTestPayload) =>
        api.post<MonitorTestResponse>('/api/service-monitors/test', payload),

    /**
     * Create a new monitor
     */
    create: (payload: MonitorCreatePayload) =>
        api.post<MonitorSaveResponse>('/api/service-monitors', payload),

    /**
     * Update an existing monitor
     */
    update: (monitorId: string, payload: MonitorUpdatePayload) =>
        api.put<MonitorSaveResponse>(`/api/service-monitors/${monitorId}`, payload),

    /**
     * Delete a monitor
     */
    delete: (monitorId: string) =>
        api.delete<{ success: boolean }>(`/api/service-monitors/${monitorId}`),

    /**
     * Save display order for monitors
     */
    reorder: (orderedIds: string[]) =>
        api.put<{ success: boolean }>('/api/service-monitors/reorder', { orderedIds }),
};

export default serviceMonitorsApi;
