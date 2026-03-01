/**
 * Jellyfin Adapter
 * 
 * Extends BaseAdapter with self-healing reauthentication.
 * When a 401/403 is received, automatically reauthenticates using stored
 * credentials, updates the DB, refreshes realtime connections, and retries.
 * 
 * Auth: MediaBrowser Token="<apiKey>"
 */

import { AxiosResponse } from 'axios';
import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance } from '../types';
import { HttpOpts } from '../httpTypes';
import { AdapterError } from '../errors';
import { reauthenticate } from '../../utils/reauth';
import logger from '../../utils/logger';

// ============================================================================
// JELLYFIN ADAPTER
// ============================================================================

export class JellyfinAdapter extends BaseAdapter {
    readonly testEndpoint = '/System/Info';

    validateConfig(instance: PluginInstance): boolean {
        return !!(instance.config.url && instance.config.apiKey && instance.config.userId);
    }

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        const apiKey = instance.config.apiKey as string;
        return {
            'Authorization': `MediaBrowser Token="${apiKey}"`,
            'Accept': 'application/json',
        };
    }

    /**
     * Parse Jellyfin's /System/Info response for test connection.
     * Returns ServerName and Version.
     */
    protected parseTestResponse(data: unknown): { version?: string } {
        const obj = data as Record<string, unknown> | null;
        return { version: obj?.Version as string | undefined };
    }

    /**
     * Override request() to add reauthentication interceptor.
     * 
     * Flow:
     *   1. Try the request via BaseAdapter.request()
     *   2. If AUTH_FAILED → call reauthenticate(instance.id)
     *   3. On success → refresh realtime, build fresh instance, retry once
     *   4. On failure → throw original error
     * 
     * Skips reauth for the auth endpoint itself to prevent infinite loops.
     */
    async request(
        instance: PluginInstance,
        method: string,
        path: string,
        body?: unknown,
        opts?: HttpOpts
    ): Promise<AxiosResponse> {
        try {
            return await super.request(instance, method, path, body, opts);
        } catch (error) {
            // Only intercept AUTH_FAILED errors, skip reauth endpoint
            if (!(error instanceof AdapterError) || error.code !== 'AUTH_FAILED') {
                throw error;
            }
            if (path === '/Users/AuthenticateByName') {
                throw error;
            }

            logger.warn(`[Adapter:jellyfin] Got AUTH_FAILED, attempting re-auth: id=${instance.id}`);

            const reauth = await reauthenticate(instance.id);
            if (!reauth.success || !reauth.newApiKey) {
                logger.warn(`[Adapter:jellyfin] Re-auth failed: id=${instance.id} reason="${reauth.error}"`);
                throw error;
            }

            // Refresh realtime connections so WebSocket picks up fresh token
            try {
                const { realtimeOrchestrator } = await import('../../services/sse/RealtimeOrchestrator');
                realtimeOrchestrator.refreshConnection(instance.id);
            } catch {
                // Non-fatal — realtime may not be active for this instance
            }

            // Retry with fresh credentials
            const freshInstance: PluginInstance = {
                ...instance,
                config: {
                    ...instance.config,
                    apiKey: reauth.newApiKey,
                },
            };

            logger.info(`[Adapter:jellyfin] Retry after re-auth: method=${method} path=${path}`);
            return await super.request(freshInstance, method, path, body, opts);
        }
    }
}
