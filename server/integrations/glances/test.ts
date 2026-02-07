import { TestResult } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';

// ============================================================================
// GLANCES CONNECTION TEST
// ============================================================================

export async function testConnection(config: Record<string, unknown>): Promise<TestResult> {
    const { url, password } = config;

    if (!url) {
        return { success: false, error: 'URL required' };
    }

    try {
        const translatedUrl = translateHostUrl(url as string);
        const headers: Record<string, string> = {};
        if (password) {
            headers['X-Auth'] = password as string;
        }

        const response = await axios.get(`${translatedUrl}/api/4/cpu`, {
            headers,
            httpsAgent,
            timeout: 5000,
        });

        return {
            success: true,
            message: 'Glances connection successful',
            version: response.data?.version || 'Unknown',
        };
    } catch (error) {
        const axiosError = error as { response?: { statusText?: string }; message?: string; code?: string };
        return {
            success: false,
            error: axiosError.response?.statusText || axiosError.message || axiosError.code || 'Connection failed',
        };
    }
}
