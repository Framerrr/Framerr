import { TestResult } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
import logger from '../../utils/logger';

// ============================================================================
// CUSTOM SYSTEM STATUS CONNECTION TEST
// ============================================================================

export async function testConnection(config: Record<string, unknown>): Promise<TestResult> {
    const { url, token } = config;

    if (!url) {
        return { success: false, error: 'URL required' };
    }

    try {
        const translatedUrl = translateHostUrl(url as string);
        const headers: Record<string, string> = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        await axios.get(`${translatedUrl}/status`, {
            headers,
            httpsAgent,
            timeout: 5000,
        });

        return {
            success: true,
            message: 'Connection successful',
            version: 'Unknown',
        };
    } catch (error) {
        const axiosError = error as { response?: { statusText?: string }; message?: string; code?: string };
        logger.error(`[CustomSystemStatus] Health check error: error="${axiosError.message}"`);
        return {
            success: false,
            error: axiosError.response?.statusText || axiosError.message || axiosError.code || 'Connection failed',
        };
    }
}
