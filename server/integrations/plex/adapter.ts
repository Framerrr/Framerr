import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance, TestResult } from '../types';
import { extractAdapterErrorMessage } from '../errors';

// ============================================================================
// PLEX ADAPTER
// ============================================================================

export class PlexAdapter extends BaseAdapter {
    readonly testEndpoint = '/status/sessions';

    validateConfig(instance: PluginInstance): boolean {
        return !!(instance.config.url && instance.config.token);
    }

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        return {
            'X-Plex-Token': instance.config.token as string,
            'Accept': 'application/json',
        };
    }

    /**
     * Override testConnection to extract version from response headers.
     * Plex returns version in `x-plex-version` header, not in the JSON body.
     */
    async testConnection(config: Record<string, unknown>): Promise<TestResult> {
        const tempInstance: PluginInstance = {
            id: 'test',
            type: 'plex',
            name: 'Test',
            config,
        };

        try {
            const response = await this.get(tempInstance, this.testEndpoint, { timeout: 5000 });
            const version = response.headers?.['x-plex-version'] || undefined;
            return {
                success: true,
                message: 'Connection successful',
                version,
            };
        } catch (error) {
            return {
                success: false,
                error: extractAdapterErrorMessage(error),
            };
        }
    }
}
