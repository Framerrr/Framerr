/**
 * Integration Feature Types
 * 
 * Types for the integration management system.
 * Used by integration settings and service configuration components.
 */

import { IntegrationConfig } from '../../integrations/_core/definitions';

/**
 * Integration instance from the backend database
 */
export interface IntegrationInstance {
    id: string;
    type: string;
    displayName: string;
    config: Record<string, unknown>;
    enabled: boolean;
    createdAt: string;
    updatedAt: string | null;
}

/**
 * State type for all integrations - keyed by INSTANCE ID (not type)
 * This allows multiple instances of the same type with isolated configs
 */
export type IntegrationsState = Record<string, IntegrationConfig>;

/**
 * Test state for connection testing
 */
export interface TestState {
    loading: boolean;
    success?: boolean;
    message?: string;
}

// Re-export frequently used types from definitions
export type { IntegrationConfig, PlexConfig } from '../../integrations/_core/definitions';
