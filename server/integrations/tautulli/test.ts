import { TestResult } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';

// ============================================================================
// TAUTULLI CONNECTION TEST
// ============================================================================

export async function testConnection(config: Record<string, unknown>): Promise<TestResult> {
    const { url, apiKey } = config;

    if (!url || !apiKey) {
        return { success: false, error: 'URL and API key required' };
    }

    const baseUrl = (url as string).replace(/\/$/, '');

    try {
        const response = await axios.get(`${baseUrl}/api/v2`, {
            params: {
                apikey: apiKey as string,
                cmd: 'get_tautulli_info',
            },
            httpsAgent,
            timeout: 5000,
        });

        const tautulliResponse = response.data?.response;
        if (tautulliResponse?.result === 'success') {
            const version = tautulliResponse.data?.tautulli_version || 'Unknown';
            return {
                success: true,
                message: `Tautulli v${version}`,
                version,
            };
        }

        return {
            success: false,
            error: tautulliResponse?.message || 'Invalid API response',
        };
    } catch (error) {
        const axiosError = error as { response?: { status?: number; data?: { message?: string } }; message?: string };

        // Tautulli returns 401 for invalid API keys
        if (axiosError.response?.status === 401) {
            return { success: false, error: 'Invalid API key' };
        }

        return {
            success: false,
            error: axiosError.message || 'Connection failed',
        };
    }
}
