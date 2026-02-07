import axios from 'axios';
import { TestResult } from '../types';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';

// ============================================================================
// JELLYFIN CONNECTION TEST
// ============================================================================

export async function testConnection(config: Record<string, unknown>): Promise<TestResult> {
    const url = config.url as string;
    const apiKey = config.apiKey as string;

    if (!url || !apiKey) {
        return { success: false, error: 'URL and API Key are required' };
    }

    try {
        const baseUrl = translateHostUrl(url).replace(/\/$/, '');
        const response = await axios.get(`${baseUrl}/System/Info`, {
            headers: {
                'Authorization': `MediaBrowser Token="${apiKey}"`,
                'Accept': 'application/json',
            },
            httpsAgent,
            timeout: 10000,
        });

        const serverName = response.data?.ServerName || 'Jellyfin Server';
        const version = response.data?.Version || 'unknown';

        return {
            success: true,
            message: `Connected to ${serverName}`,
            version,
        };
    } catch (error) {
        const axiosError = error as { response?: { status: number }; message: string };

        if (axiosError.response?.status === 401) {
            return { success: false, error: 'Invalid API key' };
        }

        return { success: false, error: axiosError.message };
    }
}
