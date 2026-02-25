/**
 * Tautulli Integration - Adapter
 *
 * Extends BaseAdapter with query-param authentication (apikey in URL params).
 * Tautulli's API uses GET requests to /api/v2 with apikey and cmd query params.
 */

import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance, TestResult } from '../types';
import { HttpOpts } from '../httpTypes';
import { AxiosResponse } from 'axios';
import { extractAdapterErrorMessage } from '../errors';

// ============================================================================
// TAUTULLI ADAPTER
// ============================================================================

export class TautulliAdapter extends BaseAdapter {
    readonly testEndpoint = '/api/v2';

    getAuthHeaders(_instance: PluginInstance): Record<string, string> {
        return { 'Accept': 'application/json' };
    }

    validateConfig(instance: PluginInstance): boolean {
        return !!(instance.config.url && instance.config.apiKey);
    }

    /** Override get() to inject apikey as query param (Tautulli auth pattern) */
    async get(instance: PluginInstance, path: string, opts?: HttpOpts): Promise<AxiosResponse> {
        const apiKey = instance.config.apiKey as string;
        return super.get(instance, path, {
            ...opts,
            params: { apikey: apiKey, ...opts?.params },
        });
    }

    /** Override: Tautulli test needs cmd=get_tautulli_info param */
    async testConnection(config: Record<string, unknown>): Promise<TestResult> {
        const tempInstance: PluginInstance = { id: 'test', type: 'test', name: 'Test', config };
        try {
            const response = await this.get(tempInstance, this.testEndpoint, {
                params: { cmd: 'get_tautulli_info' },
                timeout: 5000,
            });
            const { version } = this.parseTestResponse(response.data);
            return { success: true, message: 'Connection successful', version };
        } catch (error) {
            return { success: false, error: extractAdapterErrorMessage(error) };
        }
    }

    protected parseTestResponse(data: unknown): { version?: string } {
        const obj = data as { response?: { data?: { tautulli_version?: string } } };
        return { version: obj?.response?.data?.tautulli_version };
    }
}
