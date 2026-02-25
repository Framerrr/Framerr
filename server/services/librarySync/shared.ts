/**
 * Library Sync Shared Helpers
 * 
 * Constants, state management, and utility functions used
 * by all sync types (Plex, Jellyfin, Emby).
 */

import { getDb } from '../../database/db';
import logger from '../../utils/logger';
import { getInstanceById, getAllInstances, IntegrationInstance } from '../../db/integrationInstances';
import { PluginInstance } from '../../integrations/types';
import { broadcast } from '../sse/transport';
import { SyncStatus } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Number of items to fetch per paginated API request */
export const LIBRARY_SYNC_PAGE_SIZE = 500;

/** Timeout per page request (60 seconds — large libraries on slow servers need this) */
export const LIBRARY_SYNC_TIMEOUT = 60000;

/** Maximum retries per page on transient failures (timeout, network, 5xx) */
export const LIBRARY_SYNC_MAX_RETRIES = 2;

// ============================================================================
// ACTIVE SYNC STATE
// ============================================================================

/** Track active syncs for cancellation */
export const activeSyncs: Map<string, { cancelled: boolean }> = new Map();

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert IntegrationInstance to PluginInstance format.
 * Used by sync functions to interact with adapters.
 * 
 * @deprecated Use `toPluginInstance` from `server/integrations/utils` instead.
 * This copy will be removed in Phase 7 cleanup.
 */
export function toPluginInstance(instance: IntegrationInstance): PluginInstance {
    return {
        id: instance.id,
        type: instance.type,
        name: instance.displayName,
        config: instance.config,
    };
}

/**
 * Update sync status in database.
 * Ensures the status row exists (INSERT OR IGNORE) before updating.
 */
export function updateSyncStatus(integrationId: string, updates: Partial<SyncStatus>): void {
    const db = getDb();

    // Ensure row exists
    db.prepare(`
        INSERT OR IGNORE INTO library_sync_status (integration_instance_id)
        VALUES (?)
    `).run(integrationId);

    // Build dynamic update
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.totalItems !== undefined) {
        setClauses.push('total_items = ?');
        values.push(updates.totalItems);
    }
    if (updates.indexedItems !== undefined) {
        setClauses.push('indexed_items = ?');
        values.push(updates.indexedItems);
    }
    if (updates.lastSyncStarted !== undefined) {
        setClauses.push('last_sync_started = ?');
        values.push(updates.lastSyncStarted);
    }
    if (updates.lastSyncCompleted !== undefined) {
        setClauses.push('last_sync_completed = ?');
        values.push(updates.lastSyncCompleted);
    }
    if (updates.syncStatus !== undefined) {
        setClauses.push('sync_status = ?');
        values.push(updates.syncStatus);
    }
    if (updates.errorMessage !== undefined) {
        setClauses.push('error_message = ?');
        values.push(updates.errorMessage);
    }

    if (setClauses.length > 0) {
        values.push(integrationId);
        db.prepare(`
            UPDATE library_sync_status
            SET ${setClauses.join(', ')}
            WHERE integration_instance_id = ?
        `).run(...values);
    }
}

/**
 * Broadcast sync status update via SSE to all connected clients.
 */
export function broadcastSyncStatus(integrationId: string, data: Record<string, unknown>): void {
    broadcast('library-sync-status', {
        integrationId,
        ...data,
    });
}

/**
 * Get all media server integrations (plex/jellyfin/emby) that have library sync enabled.
 */
export function getMediaServerIntegrationsWithSync(): IntegrationInstance[] {
    const allInstances = getAllInstances();
    return allInstances.filter(inst => {
        if (!['plex', 'jellyfin', 'emby'].includes(inst.type)) return false;
        if (!inst.enabled) return false;
        const config = inst.config as { librarySyncEnabled?: boolean | string };
        return config?.librarySyncEnabled === true || config?.librarySyncEnabled === 'true';
    });
}

// Re-export for convenience
export { getInstanceById } from '../../db/integrationInstances';
export type { IntegrationInstance } from '../../db/integrationInstances';
export type { PluginInstance } from '../../integrations/types';
export { logger };

// ============================================================================
// RETRY HELPER
// ============================================================================

import type { ProxyResult } from '../../integrations/types';
import type { BaseAdapter } from '../../integrations/BaseAdapter';
import type { ProxyRequest } from '../../integrations/types';

/**
 * Retry an adapter.execute() call on transient failures.
 * 
 * Retries on: timeout, ECONNRESET, ECONNREFUSED, 5xx
 * Does NOT retry on: 4xx (auth errors, bad requests, not found — these are terminal)
 * 
 * @returns The ProxyResult from the last attempt (success or final failure)
 */
export async function retryWithBackoff(
    adapter: BaseAdapter,
    instance: PluginInstance,
    request: ProxyRequest,
    maxRetries: number = LIBRARY_SYNC_MAX_RETRIES
): Promise<ProxyResult> {
    let lastResult: ProxyResult | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const result = await adapter.execute(instance, request);

        if (result.success) {
            return result;
        }

        lastResult = result;

        // Don't retry on client errors (4xx) — these are terminal
        if (result.status && result.status >= 400 && result.status < 500) {
            return result;
        }

        // Don't retry on the last attempt
        if (attempt >= maxRetries) {
            break;
        }

        // Exponential backoff: 2s, 4s
        const backoffMs = Math.pow(2, attempt + 1) * 1000;
        logger.warn(`[LibrarySync] Retrying in ${backoffMs / 1000}s (attempt ${attempt + 1}/${maxRetries}): error="${result.error}"`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
    }

    return lastResult!;
}
