/**
 * Monitor Integration - Adapter
 *
 * Extends BaseAdapter for interface compliance.
 * Monitor is unique — it reads local system stats from the database,
 * not from an external service. No HTTP calls are made.
 */

import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance, TestResult } from '../types';

// ============================================================================
// MONITOR ADAPTER
// ============================================================================

export class MonitorAdapter extends BaseAdapter {
    readonly testEndpoint = '/';

    getAuthHeaders(_instance: PluginInstance): Record<string, string> {
        return {};
    }

    validateConfig(_instance: PluginInstance): boolean {
        // No external config required — monitors stored in local DB
        return true;
    }

    getBaseUrl(_instance: PluginInstance): string {
        // Local adapter — no external URL
        return '';
    }

    /**
     * Test connection for Framerr's built-in monitoring.
     * Always succeeds — this is a local database integration.
     */
    async testConnection(_config: Record<string, unknown>): Promise<TestResult> {
        return {
            success: true,
            message: 'Framerr Monitor is ready. Configure monitors in the Service Status widget.',
        };
    }
}
