/**
 * System API Endpoints
 * System configuration, diagnostics, debug tools, and logging
 */
import { api } from '../client';
import { ApiResponse } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface SystemConfig {
    appName?: string;
    faviconUrl?: string;
    theme?: {
        mode?: string;
        customColors?: Record<string, string>;
    };
    debug?: {
        overlayEnabled?: boolean;
        logLevel?: string;
    };
    [key: string]: unknown;
}

export interface DiagnosticsInfo {
    version: string;
    uptime: number;
    memoryUsage: {
        used: number;
        total: number;
    };
    cpuUsage: number;
}

export interface SystemInfo {
    version: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    uptime: number;
    hostname: string;
    [key: string]: unknown;
}

export interface Resources {
    cpu: {
        usage: number;
        cores: number;
    };
    memory: {
        used: number;
        total: number;
        percentage: number;
    };
    disk?: {
        used: number;
        total: number;
        percentage: number;
    };
}

export interface SseStatus {
    success: boolean;
    connected: boolean;
    clients: number;
}

export interface DbStatus {
    success: boolean;
    status: 'healthy' | 'error';
    error?: string;
    tables?: number;
    size?: string;
}

export interface ApiHealth {
    success: boolean;
    overallStatus: 'healthy' | 'error' | 'warning';
    endpoints?: Array<{
        name: string;
        status: 'healthy' | 'error';
        latency?: number;
    }>;
    error?: string;
}

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    [key: string]: unknown;
}

export interface LogsResponse {
    success: boolean;
    logs: LogEntry[];
}

export interface SystemConfigResponse {
    success: boolean;
    config: SystemConfig;
}

// ============================================================================
// Endpoints
// ============================================================================

export const systemApi = {
    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Get system configuration
     */
    getConfig: () =>
        api.get<SystemConfig>('/api/config'),

    /**
     * Update system configuration
     */
    updateConfig: (config: Partial<SystemConfig>) =>
        api.put<void>('/api/config', config),

    /**
     * Update system-level configuration (app name, etc.)
     */
    updateSystemConfig: (config: { appName?: string;[key: string]: unknown }) =>
        api.put<void>('/api/config/system', config),

    /**
     * Get user-specific configuration
     */
    getUserConfig: () =>
        api.get<SystemConfig>('/api/config/user'),

    /**
     * Update user-specific configuration
     */
    updateUserConfig: (config: Partial<SystemConfig>) =>
        api.put<ApiResponse<void>>('/api/config/user', config),

    // =========================================================================
    // Debug Settings (used by useDebugSettings)
    // =========================================================================

    /**
     * Get full system config including debug settings
     */
    getFullConfig: () =>
        api.get<SystemConfigResponse>('/api/system/config'),

    /**
     * Update debug/system config (overlay, log level, etc.)
     */
    updateFullConfig: (config: Partial<SystemConfig>) =>
        api.put<ApiResponse<void>>('/api/system/config', config),

    // =========================================================================
    // Logs Management (used by useDebugSettings)
    // =========================================================================

    /**
     * Get advanced logs
     */
    getAdvancedLogs: () =>
        api.get<LogsResponse>('/api/advanced/logs'),

    /**
     * Set log level
     */
    setLogLevel: (level: string) =>
        api.post<ApiResponse<void>>('/api/advanced/logs/level', { level }),

    /**
     * Clear all logs
     */
    clearAdvancedLogs: () =>
        api.post<ApiResponse<void>>('/api/advanced/logs/clear'),

    /**
     * Download logs as file
     */
    downloadLogs: () =>
        api.get<Blob>('/api/advanced/logs/download', { responseType: 'blob' }),

    // =========================================================================
    // System Information (used by useSystemSettings)
    // =========================================================================

    /**
     * Get system info (version, platform, uptime)
     */
    getSystemInfo: () =>
        api.get<ApiResponse<SystemInfo>>('/api/advanced/system/info'),

    /**
     * Get resource usage (CPU, memory, disk)
     */
    getResources: () =>
        api.get<ApiResponse<Resources>>('/api/advanced/system/resources'),

    // =========================================================================
    // Health & Diagnostics (used by useSystemSettings)
    // =========================================================================

    /**
     * Get SSE connection status
     */
    getSseStatus: () =>
        api.get<SseStatus>('/api/diagnostics/sse-status'),

    /**
     * Test database connection
     */
    testDatabase: () =>
        api.get<DbStatus>('/api/diagnostics/database'),

    /**
     * Test API health
     */
    testApiHealth: () =>
        api.get<ApiHealth>('/api/diagnostics/api-health'),

    // =========================================================================
    // Speed Test (used by useSystemSettings)
    // =========================================================================

    /**
     * TCP warmup for speed test
     */
    speedTestWarmup: () =>
        api.get<Blob>('/api/diagnostics/warmup', { responseType: 'blob' }),

    /**
     * Ping for latency measurement
     */
    speedTestPing: () =>
        api.get<void>('/api/diagnostics/ping'),

    /**
     * Download test
     */
    speedTestDownload: (sizeMb: number) =>
        api.post<Blob>('/api/diagnostics/download', { size: sizeMb }, { responseType: 'blob' }),

    /**
     * Upload test
     */
    speedTestUpload: (data: { data: string }) =>
        api.post<ApiResponse<void>>('/api/diagnostics/upload', data),

    // =========================================================================
    // Legacy (keep for compatibility)
    // =========================================================================

    /**
     * Get system diagnostics (legacy)
     */
    getDiagnostics: () =>
        api.get<DiagnosticsInfo>('/api/system/diagnostics'),

    /**
     * Get server logs (legacy)
     */
    getLogs: (level?: string) =>
        api.get<string[]>('/api/system/logs', { params: { level } }),

    /**
     * Clear server logs (legacy)
     */
    clearLogs: () =>
        api.delete<ApiResponse<void>>('/api/system/logs'),
};

export default systemApi;
