import { PluginAdapter, PluginInstance, ProxyRequest, ProxyResult } from '../types';
import axios, { AxiosRequestConfig } from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
import logger from '../../utils/logger';

// ============================================================================
// TAUTULLI ADAPTER
// ============================================================================

/**
 * Tautulli uses query-param auth (?apikey=) instead of headers.
 * All API calls go to /api/v2 with cmd as a query param.
 */
export class TautulliAdapter implements PluginAdapter {
    validateConfig(instance: PluginInstance): boolean {
        return !!(instance.config.url && instance.config.apiKey);
    }

    getBaseUrl(instance: PluginInstance): string {
        const url = instance.config.url as string;
        return translateHostUrl(url.replace(/\/$/, ''));
    }

    getAuthHeaders(): Record<string, string> {
        // Tautulli uses query-param auth, not headers
        return {};
    }

    async execute(instance: PluginInstance, request: ProxyRequest): Promise<ProxyResult> {
        if (!this.validateConfig(instance)) {
            return { success: false, error: 'Invalid integration configuration', status: 400 };
        }

        const baseUrl = this.getBaseUrl(instance);
        const apiKey = instance.config.apiKey as string;

        // Tautulli API: /api/v2?apikey=KEY&cmd=COMMAND&other_params
        // The request.path is used as the cmd value
        const cmd = request.path.replace(/^\//, '');

        const config: AxiosRequestConfig = {
            method: 'GET', // Tautulli API is read-only GET
            url: `${baseUrl}/api/v2`,
            params: {
                apikey: apiKey,
                cmd,
                ...request.query,
            },
            httpsAgent,
            timeout: 15000,
        };

        try {
            logger.debug(`[Adapter:tautulli] Request: cmd=${cmd}`);
            const response = await axios(config);

            // Tautulli wraps everything in { response: { result: "success", data: {...} } }
            const tautulliResponse = response.data?.response;
            if (tautulliResponse?.result === 'success') {
                return { success: true, data: tautulliResponse.data };
            }

            return {
                success: false,
                error: tautulliResponse?.message || 'Tautulli returned an error',
                status: 400,
            };
        } catch (error) {
            const axiosError = error as { response?: { status: number; data?: unknown }; message: string };
            logger.error(`[Adapter:tautulli] Failed: error="${axiosError.message}" status=${axiosError.response?.status}`);
            return {
                success: false,
                error: axiosError.message,
                status: axiosError.response?.status || 500,
            };
        }
    }
}
