// System Settings Types

export type HealthStatus = 'healthy' | 'error' | 'warning';
export type SpeedTestStage = 'latency' | 'download' | 'upload' | null;

export interface SystemInfo {
    appVersion?: string;
    nodeVersion?: string;
    platform?: string;
    arch?: string;
    uptime?: number;
}

export interface MemoryInfo {
    used: number;
    total: number;
    percentage: number;
}

export interface Resources {
    cpu?: {
        usage: number;
        cores: number;
    };
    memory?: MemoryInfo;
    disk?: {
        used: number;
        total: number;
        percentage: number;
    };
}

export interface HealthItem {
    status: HealthStatus;
    message: string;
}

export interface DbDetails {
    type?: string;
    path?: string;
    sizeKB?: number;
    userCount?: number;
    tableCount?: number;
}

export interface DbStatus {
    success: boolean;
    status: HealthStatus;
    latency?: number;
    details?: DbDetails;
    error?: string;
}

export interface SpeedTestState {
    running: boolean;
    latency: number | null;
    download: string | null;
    upload: string | null;
    jitter: number | null;
    stage: SpeedTestStage;
}

export interface ApiEndpoint {
    name: string;
    path?: string;
    status: HealthStatus;
    responseTime?: number;
    latency?: number;
    category?: string;
    error?: string;
}

export interface ApiHealth {
    success: boolean;
    overallStatus: HealthStatus;
    categories?: Record<string, ApiEndpoint[]>;
    endpoints?: ApiEndpoint[];
    error?: string;
}

export interface IntegrationStatus {
    name: string;
    enabled?: boolean;
    connected?: boolean;
    status?: 'healthy' | 'error' | 'warning';
    responseTime?: number;
    message?: string;
    error?: string;
}

export interface IntegrationHealth {
    success: boolean;
    summary?: string;
    integrations: IntegrationStatus[];
}

export interface SseStatus {
    success: boolean;
    status?: 'active' | 'idle' | 'error';
    connected?: boolean;
    connectedClients?: number;
    clients?: number;
}

// Debug Settings Types

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
export type FilterLevel = 'ALL' | LogLevel;

export interface LogEntry {
    timestamp?: string;
    level?: string;
    message?: string;
    [key: string]: unknown;
}

export interface SystemConfigResponse {
    config?: {
        debug?: {
            overlayEnabled?: boolean;
            logLevel?: string;
        };
    };
}

export interface LogsResponse {
    success: boolean;
    logs?: LogEntry[];
}

export const LOG_LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
export const FILTER_LEVELS: FilterLevel[] = ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];

