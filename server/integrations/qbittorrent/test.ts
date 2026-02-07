import { TestResult } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';

// ============================================================================
// QBITTORRENT CONNECTION TEST
// ============================================================================

/**
 * Test qBittorrent connection by attempting login and fetching version.
 * 
 * qBittorrent uses cookie-based auth:
 * 1. POST to /api/v2/auth/login with username/password
 * 2. On success, use returned cookie to fetch /api/v2/app/version
 */
export async function testConnection(config: Record<string, unknown>): Promise<TestResult> {
    const { url, username, password } = config;

    if (!url) {
        return { success: false, error: 'URL required' };
    }

    try {
        const translatedUrl = translateHostUrl(url as string);

        // Build form data for login
        const formData = new URLSearchParams();
        if (username) formData.append('username', username as string);
        if (password) formData.append('password', password as string);

        // Attempt login
        const loginResponse = await axios.post(
            `${translatedUrl}/api/v2/auth/login`,
            formData,
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                httpsAgent,
                timeout: 5000,
            }
        );

        // qBittorrent returns 'Ok.' on successful login, or HTTP 200 with cookies
        if (loginResponse.data === 'Ok.' || loginResponse.status === 200) {
            // Try to get version using the session cookie
            try {
                const cookie = loginResponse.headers['set-cookie']?.[0];
                const versionResponse = await axios.get(`${translatedUrl}/api/v2/app/version`, {
                    headers: cookie ? { Cookie: cookie } : {},
                    httpsAgent,
                    timeout: 5000,
                });

                return {
                    success: true,
                    message: 'Connection successful',
                    version: versionResponse.data || 'Unknown',
                };
            } catch {
                // Login worked but couldn't get version - still successful
                return {
                    success: true,
                    message: 'Connection successful',
                    version: 'Unknown',
                };
            }
        }

        // Login failed (non-200 or unexpected response)
        return { success: false, error: 'Authentication failed' };
    } catch (error) {
        const axiosError = error as { response?: { data?: string }; message?: string };
        return {
            success: false,
            error: axiosError.response?.data || axiosError.message || 'Connection failed',
        };
    }
}
