/**
 * Notification Feature Types
 * 
 * Shared type definitions for the notifications feature.
 */

import { LucideIcon } from 'lucide-react';

// ============================================================================
// Webhook Configuration Types
// ============================================================================

export interface WebhookConfig {
    webhookEnabled?: boolean;
    webhookToken?: string;
    adminEvents?: string[];
    userEvents?: string[];
}

export interface IntegrationConfig {
    enabled?: boolean;
    url?: string;
    apiKey?: string;
    isConfigured?: boolean;
    webhookConfig?: WebhookConfig;
}

export interface IntegrationsState {
    [key: string]: IntegrationConfig;
}

// ============================================================================
// User Settings Types
// ============================================================================

export interface UserIntegrationSetting {
    enabled?: boolean;
    events?: string[];
}

export interface UserIntegrationSettingsState {
    [key: string]: UserIntegrationSetting;
}

export interface SharedIntegration {
    id: string;              // Instance ID (e.g., uuid)
    name: string;            // Integration type (e.g., 'sonarr')
    type: string;            // Same as name, for compatibility
    displayName?: string;    // Friendly name set by admin
    enabled: boolean;
    webhookConfig?: WebhookConfig;
    config?: {               // Full config from /shared API
        webhookConfig?: WebhookConfig;
        [key: string]: unknown;
    };
}

// User-visible integration instance for per-instance notifications
export interface VisibleIntegrationInstance {
    instanceId: string;      // Unique instance ID
    type: string;            // Integration type (sonarr, radarr, etc.)
    displayName: string;     // Friendly name to show in UI
    description: string;     // Integration description
    webhookConfig: WebhookConfig;
}

// ============================================================================
// Push Notification Types
// ============================================================================

export interface PushSubscription {
    id: string;
    endpoint: string;
    deviceName?: string;
    lastUsed?: number | string;
    createdAt: number | string;
}

// ============================================================================
// UI Types
// ============================================================================

export interface WebhookIntegrationDef {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
}

export interface IntegrationEvent {
    key: string;
    label: string;
    description?: string;
}

export interface GeneralSettingsUpdates {
    enabled?: boolean;
    sound?: boolean;
    receiveUnmatched?: boolean;
}
