/**
 * Unraid Integration - Connection Test
 *
 * Tests connectivity to Unraid GraphQL API.
 * Provides clear error messages for common failure modes:
 * - Pre-7.2 server (no GraphQL endpoint)
 * - Invalid API key
 * - Unreachable server
 */

import { TestResult } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';

// ============================================================================
// UNRAID CONNECTION TEST
// ============================================================================

/** Minimal query to verify API access and retrieve version info */
const TEST_QUERY = `
query TestConnection {
    info {
        os {
            platform
        }
    }
}
`;

export async function testConnection(config: Record<string, unknown>): Promise<TestResult> {
    const { url, apiKey } = config;

    if (!url) {
        return { success: false, error: 'URL is required' };
    }

    if (!apiKey) {
        return { success: false, error: 'API Key is required' };
    }

    try {
        const translatedUrl = translateHostUrl(url as string);
        const response = await axios.post(
            `${translatedUrl}/graphql`,
            { query: TEST_QUERY },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey as string,
                },
                httpsAgent,
                timeout: 10000,
            }
        );

        // GraphQL can return 200 with errors in the response body
        if (response.data?.errors?.length) {
            const firstError = response.data.errors[0]?.message || 'Unknown GraphQL error';
            return {
                success: false,
                error: `GraphQL error: ${firstError}`,
            };
        }

        // Verify we got valid data back
        if (response.data?.data?.info) {
            const platform = response.data.data.info.os?.platform || 'Unraid';
            return {
                success: true,
                message: `Connected to ${platform} server`,
                version: platform,
            };
        }

        return {
            success: true,
            message: 'Unraid connection successful',
        };
    } catch (error) {
        const axiosError = error as {
            response?: { status: number; statusText?: string; data?: unknown };
            message?: string;
            code?: string;
        };

        // Specific error messages based on status code
        if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
            return {
                success: false,
                error: 'Invalid API key. Generate one in Settings → Management Access → API Keys (Viewer role recommended).',
            };
        }

        if (axiosError.response?.status === 404) {
            return {
                success: false,
                error: 'GraphQL API not found. This integration requires Unraid 7.2+ or the Unraid Connect plugin.',
            };
        }

        // Connection refused, timeout, DNS failure, etc.
        return {
            success: false,
            error: axiosError.message || axiosError.code || 'Connection failed',
        };
    }
}
