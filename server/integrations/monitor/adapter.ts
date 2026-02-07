import { PluginAdapter, PluginInstance, ProxyRequest, ProxyResult } from '../types';
import logger from '../../utils/logger';

// ============================================================================
// MONITOR ADAPTER (First-party Framerr Monitoring - Local DB)
// ============================================================================

/**
 * MonitorAdapter handles Framerr's built-in service monitoring.
 * Unlike other adapters that proxy to external services, this adapter
 * signals that the request should be handled locally via the service_monitors table.
 * 
 * The actual database query is performed by secureProxy.ts when it sees
 * the `_localQuery` flag in the response.
 */
export class MonitorAdapter implements PluginAdapter {
    validateConfig(_instance: PluginInstance): boolean {
        // No external config required - monitors stored in local DB
        return true;
    }

    getBaseUrl(_instance: PluginInstance): string {
        // Local adapter - no external URL
        return '';
    }

    getAuthHeaders(_instance: PluginInstance): Record<string, string> {
        // No external auth required
        return {};
    }

    async execute(instance: PluginInstance, request: ProxyRequest): Promise<ProxyResult> {
        // Route to internal service monitor endpoints based on path
        // The secureProxy will handle this specially for 'monitor' type
        logger.debug(`[Adapter:monitor] Request for instance ${instance.id}`, { path: request.path });

        // Return metadata to let the proxy know this is a local DB query
        return {
            success: true,
            data: {
                _localQuery: true,
                integrationInstanceId: instance.id,
                path: request.path,
                method: request.method,
            },
        };
    }
}
