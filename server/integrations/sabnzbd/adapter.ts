import { PluginAdapter, PluginInstance, ProxyRequest, ProxyResult } from '../types';
import axios, { AxiosRequestConfig } from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
import logger from '../../utils/logger';

// ============================================================================
// SABNZBD ADAPTER (API Key Query Param Auth)
// ============================================================================

/**
 * SABnzbd uses a simple API key passed as a query parameter.
 * No session management needed — much simpler than qBittorrent.
 * 
 * All requests go to: {url}/api?apikey={key}&mode={mode}&output=json
 */
export class SABnzbdAdapter implements PluginAdapter {
    validateConfig(instance: PluginInstance): boolean {
        return !!(instance.config.url && instance.config.apiKey);
    }

    getBaseUrl(instance: PluginInstance): string {
        const url = instance.config.url as string;
        return translateHostUrl(url);
    }

    getAuthHeaders(_instance: PluginInstance): Record<string, string> {
        // SABnzbd uses query param auth, not headers
        return {};
    }

    async execute(instance: PluginInstance, request: ProxyRequest): Promise<ProxyResult> {
        if (!this.validateConfig(instance)) {
            return { success: false, error: 'Invalid integration configuration', status: 400 };
        }

        const baseUrl = this.getBaseUrl(instance);
        const apiKey = instance.config.apiKey as string;

        // SABnzbd API always goes through /api with query params
        // Inject apikey and output=json into every request
        const query = {
            ...request.query,
            apikey: apiKey,
            output: 'json',
        };

        const url = `${baseUrl}${request.path}`;

        const config: AxiosRequestConfig = {
            method: request.method,
            url,
            params: query,
            data: request.body,
            httpsAgent,
            timeout: 15000,
        };

        try {
            logger.debug(`[Adapter:sabnzbd] Request: method=${request.method} path=${request.path}`);
            const response = await axios(config);
            return { success: true, data: response.data };
        } catch (error) {
            const axiosError = error as { response?: { status: number; data?: unknown }; message: string };
            logger.error(`[Adapter:sabnzbd] Failed: error="${axiosError.message}" status=${axiosError.response?.status}`);
            return {
                success: false,
                error: axiosError.message,
                status: axiosError.response?.status || 500,
            };
        }
    }
}
