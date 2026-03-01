/**
 * Unraid Integration - Adapter
 *
 * Extends BaseAdapter for Unraid GraphQL API.
 * Uses x-api-key header authentication.
 * Overrides testConnection() for GraphQL-specific error handling.
 */

import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance, TestResult } from '../types';
import { AdapterError, extractAdapterErrorMessage } from '../errors';

// ============================================================================
// UNRAID ADAPTER
// ============================================================================

/** Minimal query to verify API access and retrieve version info */
const TEST_QUERY = `
query TestConnection {
    info {
        os {
            platform
        }
    }
}
`;

export class UnraidAdapter extends BaseAdapter {
    readonly testEndpoint = '/graphql';

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-api-key': instance.config.apiKey as string,
        };
    }

    validateConfig(instance: PluginInstance): boolean {
        return !!(instance.config.url && instance.config.apiKey);
    }

    /**
     * Override: Unraid uses GraphQL with custom error handling.
     * Preserves specific error messages for common failure modes:
     * - 404: Pre-7.2 server (no GraphQL endpoint)
     * - 401/403: Invalid API key with guidance
     * - GraphQL-level errors in response body
     */
    async testConnection(config: Record<string, unknown>): Promise<TestResult> {
        const tempInstance: PluginInstance = { id: 'test', type: 'test', name: 'Test', config };
        try {
            const response = await this.post(tempInstance, '/graphql', { query: TEST_QUERY }, { timeout: 10000 });

            // GraphQL can return 200 with errors in the response body
            if (response.data?.errors?.length) {
                const firstError = response.data.errors[0]?.message || 'Unknown GraphQL error';
                return { success: false, error: `GraphQL error: ${firstError}` };
            }

            // Verify we got valid data back
            if (response.data?.data?.info) {
                const platform = response.data.data.info.os?.platform || 'Unraid';
                return { success: true, message: `Connected to ${platform} server`, version: platform };
            }

            return { success: true, message: 'Unraid connection successful' };
        } catch (error) {
            // Preserve specific error messages for common Unraid failure modes
            if (error instanceof AdapterError) {
                const status = error.context?.status as number | undefined;
                if (status === 401 || status === 403) {
                    return { success: false, error: 'Invalid API key. Generate one in Settings → Management Access → API Keys (Viewer role recommended).' };
                }
                if (status === 404) {
                    return { success: false, error: 'GraphQL API not found. This integration requires Unraid 7.2+ or the Unraid Connect plugin.' };
                }
            }
            return { success: false, error: extractAdapterErrorMessage(error) };
        }
    }
}
