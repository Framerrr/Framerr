/**
 * SABnzbd Integration - Adapter
 *
 * Extends BaseAdapter with query-param authentication (apikey + output=json in URL params).
 * SABnzbd's API uses GET requests to /api with apikey, mode, and output query params.
 */

import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance, TestResult } from '../types';
import { HttpOpts } from '../httpTypes';
import { AxiosResponse } from 'axios';
import { extractAdapterErrorMessage } from '../errors';

// ============================================================================
// SABNZBD ADAPTER
// ============================================================================

export class SABnzbdAdapter extends BaseAdapter {
    readonly testEndpoint = '/api';

    getAuthHeaders(_instance: PluginInstance): Record<string, string> {
        return { 'Accept': 'application/json' };
    }

    validateConfig(instance: PluginInstance): boolean {
        return !!(instance.config.url && instance.config.apiKey);
    }

    /** Override get() to inject apikey + output=json as query params */
    async get(instance: PluginInstance, path: string, opts?: HttpOpts): Promise<AxiosResponse> {
        const apiKey = instance.config.apiKey as string;
        return super.get(instance, path, {
            ...opts,
            params: { apikey: apiKey, output: 'json', ...opts?.params },
        });
    }

    /** SABnzbd test needs mode=version param */
    async testConnection(config: Record<string, unknown>): Promise<TestResult> {
        const tempInstance: PluginInstance = { id: 'test', type: 'test', name: 'Test', config };
        try {
            const response = await this.get(tempInstance, this.testEndpoint, {
                params: { mode: 'version' },
                timeout: 5000,
            });
            return { success: true, message: 'Connection successful', version: response.data?.version };
        } catch (error) {
            return { success: false, error: extractAdapterErrorMessage(error) };
        }
    }
}
