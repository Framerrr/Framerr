import { TestResult } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';

// ============================================================================
// OVERSEERR CONNECTION TEST
// ============================================================================

export async function testConnection(config: Record<string, unknown>): Promise<TestResult> {
    const { url, apiKey } = config;

    if (!url || !apiKey) {
        return { success: false, error: 'URL and API key required' };
    }

    try {
        const response = await axios.get(`${url}/api/v1/settings/public`, {
            headers: { 'X-Api-Key': apiKey as string },
            httpsAgent,
            timeout: 5000,
        });

        return {
            success: true,
            message: 'Connection successful',
            version: response.data.version || 'Unknown',
        };
    } catch (error) {
        const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
        return {
            success: false,
            error: axiosError.response?.data?.message || axiosError.message || 'Connection failed',
        };
    }
}
