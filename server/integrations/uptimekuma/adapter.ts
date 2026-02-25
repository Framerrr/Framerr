/**
 * Uptime Kuma Integration - Adapter
 *
 * Extends BaseAdapter with Basic Auth (empty username, API key as password).
 * Uses /metrics endpoint which returns Prometheus text format.
 * Overrides testConnection() for Prometheus text parsing and HTML auth detection.
 */

import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance, TestResult } from '../types';
import { extractAdapterErrorMessage } from '../errors';

// ============================================================================
// UPTIME KUMA ADAPTER
// ============================================================================

export class UptimeKumaAdapter extends BaseAdapter {
    readonly testEndpoint = '/metrics';

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        const apiKey = instance.config.apiKey as string;
        return {
            'Accept': 'text/plain',
            'Authorization': `Basic ${Buffer.from(':' + apiKey).toString('base64')}`,
        };
    }

    validateConfig(instance: PluginInstance): boolean {
        return !!(instance.config.url && instance.config.apiKey);
    }

    /**
     * Override: Uptime Kuma test parses Prometheus text to count monitors.
     * Also detects HTML responses indicating authentication failure.
     */
    async testConnection(config: Record<string, unknown>): Promise<TestResult> {
        const tempInstance: PluginInstance = { id: 'test', type: 'test', name: 'Test', config };
        try {
            const response = await this.get(tempInstance, '/metrics', { timeout: 10000 });
            const metricsText = response.data as string;

            // Check for HTML (auth failed — Uptime Kuma redirects to login page)
            if (typeof metricsText === 'string' && (metricsText.startsWith('<!DOCTYPE') || metricsText.startsWith('<html'))) {
                return { success: false, error: 'Authentication failed — invalid API key' };
            }

            // Count unique monitors from Prometheus metrics
            const monitorNames = new Set<string>();
            if (typeof metricsText === 'string') {
                const lines = metricsText.split('\n');
                for (const line of lines) {
                    const match = line.match(/monitor_status\{[^}]*monitor_name="([^"]*)"[^}]*\}/);
                    if (match) {
                        monitorNames.add(match[1]);
                    }
                }
            }

            return {
                success: true,
                message: `Connected to Uptime Kuma (${monitorNames.size} monitors)`,
            };
        } catch (error) {
            return { success: false, error: extractAdapterErrorMessage(error) };
        }
    }
}
