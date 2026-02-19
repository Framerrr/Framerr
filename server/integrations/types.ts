/**
 * Integration Plugin System - Canonical Types
 *
 * These are the TARGET interfaces for all integrations.
 * Every integration (new and existing) will implement this pattern.
 *
 * P4 Phase 4.1: Interface definitions only
 * P4 Phase 4.2: All integrations migrated to this pattern
 */

// ============================================================================
// CONFIG SCHEMA (for auto-generating forms)
// ============================================================================

export type FieldType = 'text' | 'password' | 'url' | 'number' | 'checkbox' | 'select';

export interface ConfigField {
    key: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    /** If true, this field's value is redacted in API responses (replaced with sentinel) */
    sensitive?: boolean;
    options?: Array<{ value: string; label: string }>; // For 'select' type
    default?: string; // Default value (e.g., 'true' for checkboxes)
}

export interface ConfigSchema {
    fields: ConfigField[];
    infoMessage?: {
        icon?: 'info' | 'code' | 'lightbulb';
        title: string;
        content: string;
    };
}

// ============================================================================
// TEST RESULT
// ============================================================================

export interface TestResult {
    success: boolean;
    message?: string;
    error?: string;
    version?: string; // Service version if detectable
}

// ============================================================================
// PLUGIN INSTANCE (runtime config)
// ============================================================================

export interface PluginInstance {
    id: string;
    type: string;
    name: string;
    config: Record<string, unknown>;
}

// ============================================================================
// POLLER (optional real-time data)
// ============================================================================

export interface PollerConfig {
    intervalMs: number;
    poll: (instance: PluginInstance) => Promise<unknown>;

    /**
     * Subtypes for additional data endpoints (calendar, etc.)
     * Each subtype has its own polling interval and function.
     * Topic format: {type}:{subtype}:{instanceId} (e.g., "sonarr:calendar:123")
     */
    subtypes?: {
        [key: string]: {
            intervalMs: number;
            poll: (instance: PluginInstance) => Promise<unknown>;
        };
    };
}

// ============================================================================
// ADAPTER (proxy/auth handling)
// ============================================================================

export interface ProxyRequest {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    query?: Record<string, string>;
    body?: unknown;
}

export interface ProxyResult {
    success: boolean;
    data?: unknown;
    error?: string;
    status?: number;
}

export interface PluginAdapter {
    validateConfig(instance: PluginInstance): boolean;
    getBaseUrl(instance: PluginInstance): string;
    getAuthHeaders(instance: PluginInstance): Record<string, string>;
    execute(instance: PluginInstance, request: ProxyRequest): Promise<ProxyResult>;
}

// ============================================================================
// REALTIME - Push connections (Plex WebSocket, Jellyfin, etc.)
// ============================================================================

/**
 * Configuration for real-time push connections.
 * Used by integrations that support persistent connections (WebSocket, SSE from service).
 */
export interface RealtimeConfig {
    createManager: (
        instance: PluginInstance,
        onUpdate: (data: unknown) => void
    ) => RealtimeManager;
}

/**
 * Manager for a real-time connection instance.
 * Handles connection lifecycle, reconnection, and callbacks.
 */
export interface RealtimeManager {
    connect(): void;
    disconnect(): void;
    isConnected(): boolean;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: string) => void;
}

// ============================================================================
// WEBHOOK - Incoming event handling (Sonarr, Radarr, Overseerr)
// ============================================================================

/**
 * Extended settings for webhook handling.
 */
export interface WebhookSettings {
    token: string;
    enabledEvents: string[];
}

/**
 * Result of processing a webhook.
 */
export interface WebhookResult {
    success: boolean;
    message?: string;
    broadcast?: {
        topic: string;
        data: unknown;
    };
}

/**
 * Definition of a webhook event type.
 */
export interface WebhookEventDefinition {
    key: string;
    label: string;
    description?: string;
    adminOnly?: boolean;  // Deprecated - use for routing only
    category?: string;
    defaultAdmin?: boolean;  // Default ON for admin when token generated
    defaultUser?: boolean;   // Default ON for user when token generated
}

/**
 * Configuration for webhook handling.
 */
export interface WebhookConfig {
    events: WebhookEventDefinition[];
    handle: (
        payload: unknown,
        instance: PluginInstance,
        webhookSettings: WebhookSettings
    ) => Promise<WebhookResult>;
    buildExternalUrl: (instance: PluginInstance, token: string) => string;
}

// ============================================================================
// METRIC DEFINITIONS (for metric history recording)
// ============================================================================

/**
 * Declares a metric that a system-status integration produces.
 * Used by MetricHistoryService for recording and probe decisions.
 */
export interface MetricDefinition {
    /** Metric key matching the poller output field (e.g., 'cpu', 'memory', 'temperature') */
    key: string;
    /** Whether this metric is eligible for history recording */
    recordable: boolean;
    /** How to probe for external history availability (per-metric) */
    historyProbe?: {
        /** Path to probe on the integration's base URL (e.g., '/history') */
        path: string;
        /** Query params to send with the probe request */
        params: Record<string, string>;
    };
}

// ============================================================================
// INTEGRATION PLUGIN (the main interface)
// ============================================================================

export interface IntegrationPlugin {
    // === METADATA (required) ===
    id: string; // 'sonarr', 'plex', etc.
    name: string; // Display name
    description: string; // Short description
    category: 'system' | 'media' | 'management';
    icon?: string; // Icon identifier

    // === CONFIG (required) ===
    configSchema: ConfigSchema; // For form auto-generation

    // === ADAPTER (required) ===
    adapter: PluginAdapter;

    // === TEST (optional) ===
    testConnection?: (config: Record<string, unknown>) => Promise<TestResult>;

    // === POLLER (optional) ===
    poller?: PollerConfig;

    // === REALTIME (optional - Plex, Jellyfin) ===
    realtime?: RealtimeConfig;

    // === WEBHOOK (optional - Sonarr, Radarr, Overseerr) ===
    webhook?: WebhookConfig;

    // === CONNECTION FIELDS (optional - for realtime integrations) ===
    /**
     * Config fields that require connection refresh when changed.
     * If any of these fields change, refreshConnection() will be called.
     * Other field changes (like librarySyncEnabled) won't trigger reconnection.
     * 
     * Example: ['url', 'token', 'machineId'] for Plex
     */
    connectionFields?: string[];

    // === METRICS (optional — system-status integrations) ===
    /**
     * Metrics this integration produces. Used by MetricHistoryService
     * for recording decisions and external history probing.
     * Only relevant for system-status category integrations.
     */
    metrics?: MetricDefinition[];

    // === FLAGS ===
    hasCustomForm?: boolean; // True = skip form auto-generation
}

// ============================================================================
// INTEGRATION CATEGORY
// ============================================================================

export type IntegrationCategory = 'system' | 'media' | 'management';
