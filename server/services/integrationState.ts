/**
 * Integration Manager Shared State
 * 
 * Centralized state module for IntegrationManager subsystem.
 * Extracted to break circular dependency between IntegrationManager
 * (lifecycle orchestrator) and integrationReactions (CRUD hooks).
 */

import logger from '../utils/logger';

// Track initialization state
let isInitialized = false;
let servicesStarted = false;

/**
 * Integration types that affect SSE polling
 */
export const SSE_INTEGRATION_TYPES = ['plex', 'sonarr', 'radarr'];

// --- State getters/setters ---

export function isServicesStarted(): boolean {
    return servicesStarted;
}

export function setServicesStarted(value: boolean): void {
    servicesStarted = value;
}

export function isManagerInitialized(): boolean {
    return isInitialized;
}

export function setManagerInitialized(value: boolean): void {
    isInitialized = value;
}

/**
 * Get manager status for diagnostics.
 */
export function getManagerStatus(): {
    initialized: boolean;
    servicesStarted: boolean;
} {
    return {
        initialized: isInitialized,
        servicesStarted
    };
}

/**
 * Get comprehensive diagnostics including poller and realtime health.
 * Used for health endpoints and debugging.
 */
export function getDiagnostics(): {
    manager: { initialized: boolean; servicesStarted: boolean };
    pollers: import('./sse/PollerOrchestrator').PollerHealth[];
    realtime: import('./sse/RealtimeOrchestrator').RealtimeHealth[];
} {
    // Import lazily to avoid circular dependency
    const { pollerOrchestrator } = require('./sse/PollerOrchestrator');
    const { realtimeOrchestrator } = require('./sse/RealtimeOrchestrator');

    return {
        manager: {
            initialized: isInitialized,
            servicesStarted
        },
        pollers: pollerOrchestrator.getHealth(),
        realtime: realtimeOrchestrator.getHealth()
    };
}
