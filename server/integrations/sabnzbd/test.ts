import { TestResult } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';

// ============================================================================
// SABNZBD CONNECTION TEST
// ============================================================================

/**
 * Test SABnzbd connection by fetching server version via the API.
 * 
 * SABnzbd auth: API key as query parameter.
 * Endpoint: /api?mode=version&apikey=KEY&output=json
 */
export async function testConnection(config: Record<string, unknown>): Promise<TestResult> {
    const { url, apiKey } = config;

    if (!url || !apiKey) {
        return { success: false, error: 'URL and API key required' };
    }

    try {
        const translatedUrl = translateHostUrl(url as string);
        const response = await axios.get(`${translatedUrl}/api`, {
            params: {
                mode: 'version',
                apikey: apiKey as string,
                output: 'json',
            },
            httpsAgent,
            timeout: 5000,
        });

        // SABnzbd returns { version: "4.x.x" } on success
        const version = response.data?.version || response.data;

        if (version) {
            return {
                success: true,
                message: 'Connection successful',
                version: typeof version === 'string' ? version : 'Unknown',
            };
        }

        // If we got a response but no version, check for error
        if (response.data?.error) {
            return { success: false, error: response.data.error };
        }

        return { success: true, message: 'Connection successful', version: 'Unknown' };
    } catch (error) {
        const axiosError = error as { response?: { status: number; data?: { error?: string } }; message?: string };

        // SABnzbd returns 401 or a JSON error for bad API keys
        if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
            return { success: false, error: 'Invalid API key' };
        }

        return {
            success: false,
            error: axiosError.response?.data?.error || axiosError.message || 'Connection failed',
        };
    }
}
