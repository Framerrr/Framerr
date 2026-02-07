/**
 * Uptime Kuma Connection Test
 * 
 * Uses /metrics endpoint with Basic auth (same as proxy route).
 */
import axios from 'axios';
import { translateHostUrl } from '../../utils/urlHelper';
import { httpsAgent } from '../../utils/httpsAgent';
import logger from '../../utils/logger';
import { TestResult } from '../types';

/**
 * Test Uptime Kuma connection with provided config
 * Uses /metrics endpoint with Basic auth and counts monitors.
 */
export async function testConnection(config: Record<string, unknown>): Promise<TestResult> {
    const { url, apiKey } = config;
    if (!url || !apiKey) {
        return { success: false, error: 'URL and API key required' };
    }

    try {
        const translatedUrl = translateHostUrl(url as string);

        // Use Basic auth: empty username, apiKey as password (same as proxy route)
        const authHeader = `Basic ${Buffer.from(':' + apiKey).toString('base64')}`;

        // Test by fetching /metrics endpoint (same as proxy route)
        const response = await axios.get(`${translatedUrl}/metrics`, {
            headers: { 'Authorization': authHeader },
            httpsAgent,
            timeout: 10000
        });

        const metricsText = response.data as string;

        // Check if we got HTML (auth failed)
        if (metricsText.startsWith('<!DOCTYPE') || metricsText.startsWith('<html')) {
            return { success: false, error: 'Authentication failed - invalid API key' };
        }

        // Count unique monitors by name (same deduplication as proxy route)
        const monitorNames = new Set<string>();
        const lines = metricsText.split('\n');

        for (const line of lines) {
            if (line.startsWith('monitor_status{')) {
                const match = line.match(/monitor_status\{([^}]+)\}\s+(\d+)/);
                if (match) {
                    const labels = match[1];
                    const status = parseInt(match[2]);

                    // Skip pending (status 2)
                    if (status === 2) continue;

                    const nameMatch = labels.match(/monitor_name="([^"]*)"/);
                    const name = nameMatch?.[1] || 'Unknown';
                    monitorNames.add(name);
                }
            }
        }

        return {
            success: true,
            message: `Connected to Uptime Kuma (${monitorNames.size} monitors)`
        };
    } catch (error) {
        const axiosError = error as { response?: { status?: number; statusText?: string }; message?: string; code?: string };
        logger.error(`[UptimeKuma] Test failed: error="${axiosError.message}"`);
        return {
            success: false,
            error: axiosError.response?.statusText || axiosError.message || axiosError.code || 'Connection failed'
        };
    }
}
