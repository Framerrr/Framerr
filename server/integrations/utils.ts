/**
 * Integration Utilities
 * 
 * Shared utility functions for the integration system.
 * Centralized here to avoid duplication across PollerOrchestrator,
 * library sync, proxy routes, etc.
 * 
 * @module server/integrations/utils
 */

import { PluginInstance } from './types';

// Re-export IntegrationInstance for convenience
export type { IntegrationInstance } from '../db/integrationInstances';

/**
 * Convert a database IntegrationInstance to the runtime PluginInstance format.
 * 
 * This is the canonical conversion — all callers should use this function
 * instead of constructing PluginInstance objects inline.
 */
export function toPluginInstance(instance: { id: string; type: string; displayName: string; config: Record<string, unknown> }): PluginInstance {
    return {
        id: instance.id,
        type: instance.type,
        name: instance.displayName,
        config: instance.config,
    };
}
