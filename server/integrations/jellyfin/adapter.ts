import { PluginAdapter, PluginInstance, ProxyRequest, ProxyResult } from '../types';
import axios, { AxiosRequestConfig } from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
import logger from '../../utils/logger';

// ============================================================================
// JELLYFIN ADAPTER
// ============================================================================

export class JellyfinAdapter implements PluginAdapter {
    validateConfig(instance: PluginInstance): boolean {
        return !!(instance.config.url && instance.config.apiKey && instance.config.userId);
    }

    getBaseUrl(instance: PluginInstance): string {
        const url = instance.config.url as string;
        return translateHostUrl(url).replace(/\/$/, '');
    }

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        const apiKey = instance.config.apiKey as string;
        return {
            'Authorization': `MediaBrowser Token="${apiKey}"`,
            'Accept': 'application/json',
        };
    }

    async execute(instance: PluginInstance, request: ProxyRequest): Promise<ProxyResult> {
        if (!this.validateConfig(instance)) {
            return { success: false, error: 'Invalid integration configuration', status: 400 };
        }

        const baseUrl = this.getBaseUrl(instance);
        const headers = this.getAuthHeaders(instance);
        const url = `${baseUrl}${request.path}`;

        const config: AxiosRequestConfig = {
            method: request.method,
            url,
            headers,
            params: request.query,
            data: request.body,
            httpsAgent,
            timeout: 15000,
        };

        try {
            logger.debug(`[Adapter:jellyfin] Request: method=${request.method} path=${request.path}`);
            const response = await axios(config);
            return { success: true, data: response.data };
        } catch (error) {
            const axiosError = error as { response?: { status: number; data?: unknown }; message: string };
            logger.error(`[Adapter:jellyfin] Failed: error="${axiosError.message}" status=${axiosError.response?.status}`);
            return {
                success: false,
                error: axiosError.message,
                status: axiosError.response?.status || 500,
            };
        }
    }
}
