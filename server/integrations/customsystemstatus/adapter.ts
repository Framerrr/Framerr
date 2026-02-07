import { PluginAdapter, PluginInstance, ProxyRequest, ProxyResult } from '../types';
import axios, { AxiosRequestConfig } from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
import logger from '../../utils/logger';

// ============================================================================
// CUSTOM SYSTEM STATUS ADAPTER
// ============================================================================

export class CustomSystemStatusAdapter implements PluginAdapter {
    validateConfig(instance: PluginInstance): boolean {
        // Only URL required, token is optional
        return !!(instance.config.url);
    }

    getBaseUrl(instance: PluginInstance): string {
        const url = instance.config.url as string;
        return translateHostUrl(url);
    }

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        // Optional Bearer token authentication
        const token = instance.config.token as string;
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
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
            logger.debug(`[Adapter:customsystemstatus] Request: method=${request.method} path=${request.path}`);
            const response = await axios(config);
            return { success: true, data: response.data };
        } catch (error) {
            const axiosError = error as { response?: { status: number; data?: unknown }; message: string };
            logger.error(`[Adapter:customsystemstatus] Failed: error="${axiosError.message}" status=${axiosError.response?.status}`);
            return {
                success: false,
                error: axiosError.message,
                status: axiosError.response?.status || 500,
            };
        }
    }
}
