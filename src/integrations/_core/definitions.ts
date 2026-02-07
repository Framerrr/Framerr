/**
 * Service Integration Definitions
 * 
 * Type definitions for the integrations system.
 * 
 * NOTE: As of Phase 1.5, SERVICE_DEFINITIONS array has been removed.
 * All integration metadata (name, description, category, icon, fields)
 * is now fetched from the backend via /api/integrations/schemas.
 * 
 * Adding a new integration:
 *   1. Create backend plugin in server/integrations/{name}/
 *   2. Register in server/integrations/registry.ts
 *   That's it! Frontend automatically picks up the new integration.
 */

import { LucideIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface FieldDefinition {
    key: string;
    label: string;
    placeholder: string;
    type: 'text' | 'password' | 'checkbox';
    hint?: string; // Optional hint text for checkbox fields
    required?: boolean; // Defaults to true for 'url', false for others
}

/**
 * Info message configuration for display in form
 */
export interface InfoMessage {
    icon?: 'info' | 'lightbulb' | 'code';
    title: string;
    content: string;
}

export interface ServiceDefinition {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    category: 'system' | 'media' | 'management';
    fields?: FieldDefinition[];
    /** Info message shown at top of form for setup guidance */
    infoMessage?: InfoMessage;
    /** Whether this integration has a connection test button. Defaults to true. */
    hasConnectionTest?: boolean;
    /** Whether this integration supports webhooks. Defaults to false. */
    hasWebhook?: boolean;
}

export interface CategoryDefinition {
    key: ServiceDefinition['category'];
    label: string;
}

// Shared integration config type - used across components
export interface IntegrationConfig {
    enabled: boolean;
    url?: string;
    token?: string;
    apiKey?: string;
    username?: string;
    password?: string;
    _isValid?: boolean;
    isConfigured?: boolean;  // Backend-computed flag - true if integration is ready to use
    [key: string]: unknown;
}

// System status specific config
export interface SystemStatusConfig extends IntegrationConfig {
    backend: 'glances' | 'custom';
    glances: { url: string; password: string };
    custom: { url: string; token: string };
}

// Plex specific config
export interface PlexConfig extends IntegrationConfig {
    machineId?: string;
    librarySyncEnabled?: boolean;
    servers?: Array<{
        machineId: string;
        name?: string;
        owned?: boolean;
        connections?: Array<{
            uri: string;
            local?: boolean;
        }>;
    }>;
}

// Test state for connection testing
export interface TestState {
    loading?: boolean;
    success?: boolean;
    message?: string;
}

// ============================================================================
// Category Order (for display grouping)
// ============================================================================

export const CATEGORY_ORDER: CategoryDefinition[] = [
    { key: 'system', label: 'System' },
    { key: 'media', label: 'Media' },
    { key: 'management', label: 'Management' }
];
