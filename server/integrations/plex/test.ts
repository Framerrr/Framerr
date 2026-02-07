import { TestResult } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
import logger from '../../utils/logger';

// ============================================================================
// PLEX CONNECTION TEST
// ============================================================================

export async function testConnection(config: Record<string, unknown>): Promise<TestResult> {
    const { url, token } = config;

    if (!url || !token) {
        return { success: false, error: 'URL and token required' };
    }

    try {
        const translatedUrl = translateHostUrl(url as string);
        const response = await axios.get(`${translatedUrl}/status/sessions`, {
            headers: { 'X-Plex-Token': token as string },
            httpsAgent,
            timeout: 5000,
        });

        return {
            success: true,
            message: 'Connection successful',
            version: response.headers['x-plex-version'] || 'Unknown',
        };
    } catch (error) {
        const axiosError = error as { response?: { statusText?: string }; message?: string; code?: string };
        logger.error(`[Plex] Health check error: error="${axiosError.message}"`);
        return {
            success: false,
            error: axiosError.response?.statusText || axiosError.message || axiosError.code || 'Connection failed',
        };
    }
}
