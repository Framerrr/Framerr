import { PluginAdapter, PluginInstance, ProxyRequest, ProxyResult } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
import logger from '../../utils/logger';

// ============================================================================
// QBITTORRENT ADAPTER (Stateful Cookie-Based Auth)
// ============================================================================

/**
 * Cached cookie with timestamp for TTL management.
 */
interface CachedCookie {
    cookies: string[];
    timestamp: number;
}

/**
 * qBittorrent uses cookie-based authentication, not API keys.
 * 
 * This adapter handles:
 * 1. Cookie caching per instance ID with TTL (5 minutes)
 * 2. Login locks to prevent simultaneous login attempts
 * 3. Automatic re-login on 401/403 (clears cache, next request re-auths)
 * 
 * Unlike other adapters, auth is NOT handled via getAuthHeaders().
 * Instead, the execute() method manages the full login flow.
 */
export class QBittorrentAdapter implements PluginAdapter {
    // Cache cookies per instance ID with TTL
    private cookieCache: Map<string, CachedCookie> = new Map();
    // Lock to prevent simultaneous logins for same instance
    private loginLocks: Map<string, Promise<string[]>> = new Map();
    // Cookie TTL: 5 minutes
    private readonly COOKIE_TTL_MS = 5 * 60 * 1000;

    validateConfig(instance: PluginInstance): boolean {
        // Only URL is required - username/password are optional
        return !!(instance.config.url);
    }

    getBaseUrl(instance: PluginInstance): string {
        const url = instance.config.url as string;
        return translateHostUrl(url);
    }

    getAuthHeaders(_instance: PluginInstance): Record<string, string> {
        // qBittorrent uses cookie-based auth, not headers
        // Auth is handled in execute() via Cookie header
        return {};
    }

    /**
     * Get cached cookies if still valid (within TTL).
     */
    private getCachedCookies(instanceId: string): string[] | null {
        const cached = this.cookieCache.get(instanceId);
        if (cached && Date.now() - cached.timestamp < this.COOKIE_TTL_MS) {
            return cached.cookies;
        }
        // Expired or not found - clean up
        this.cookieCache.delete(instanceId);
        return null;
    }

    /**
     * Store cookies with current timestamp.
     */
    private setCachedCookies(instanceId: string, cookies: string[]): void {
        this.cookieCache.set(instanceId, {
            cookies,
            timestamp: Date.now(),
        });
    }

    /**
     * Login to qBittorrent and cache the session cookies.
     * Uses a lock to prevent multiple simultaneous logins for the same instance.
     */
    private async loginAndCacheCookies(
        instanceId: string,
        baseUrl: string,
        username: string,
        password: string
    ): Promise<string[]> {
        // Check if another request is already logging in
        const existingLogin = this.loginLocks.get(instanceId);
        if (existingLogin) {
            logger.info('[Adapter:qbittorrent] Waiting for existing login...');
            return existingLogin;
        }

        // Create a new login promise
        const loginPromise = (async () => {
            logger.info('[Adapter:qbittorrent] Logging in fresh...');
            const loginResponse = await axios.post(
                `${baseUrl}/api/v2/auth/login`,
                `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    httpsAgent,
                    timeout: 10000,
                }
            );

            const cookies = loginResponse.headers['set-cookie'] || [];
            this.setCachedCookies(instanceId, cookies);
            logger.info('[Adapter:qbittorrent] Login successful, cookies cached');
            return cookies;
        })();

        // Store the promise so other concurrent requests can wait on it
        this.loginLocks.set(instanceId, loginPromise);

        try {
            return await loginPromise;
        } finally {
            // Clear the lock when done (success or failure)
            this.loginLocks.delete(instanceId);
        }
    }

    async execute(instance: PluginInstance, request: ProxyRequest): Promise<ProxyResult> {
        if (!this.validateConfig(instance)) {
            logger.warn(`[Adapter:qbittorrent] Invalid config: keys=${Object.keys(instance.config).join(',')}`);
            return { success: false, error: 'Invalid configuration', status: 400 };
        }

        const baseUrl = this.getBaseUrl(instance);
        const username = (instance.config.username as string) || '';
        const password = (instance.config.password as string) || '';

        try {
            // Check for cached cookies first
            let cookies = this.getCachedCookies(instance.id);

            if (cookies) {
                logger.debug('[Adapter:qbittorrent] Using cached cookies');
            } else {
                cookies = await this.loginAndCacheCookies(instance.id, baseUrl, username, password);
            }

            // Build request URL
            const requestUrl = `${baseUrl}${request.path}`;

            // Build axios config - only include params/data if non-empty
            const axiosConfig: Record<string, unknown> = {
                method: request.method,
                url: requestUrl,
                headers: { Cookie: cookies.join('; ') },
                httpsAgent,
                timeout: 15000,
            };

            // Only add params if there are query parameters
            if (request.query && Object.keys(request.query).length > 0) {
                axiosConfig.params = request.query;
            }

            // Only add data for non-GET requests with body
            if (request.body && Object.keys(request.body as object).length > 0) {
                axiosConfig.data = request.body;
            }

            logger.debug(`[Adapter:qbittorrent] Request: url=${requestUrl} method=${request.method} hasParams=${!!axiosConfig.params} hasBody=${!!axiosConfig.data}`);

            const response = await axios(axiosConfig);

            return { success: true, data: response.data };
        } catch (error) {
            const axiosError = error as { message: string; response?: { status: number; data?: unknown } };

            // If we get 401/403, clear cache so next request re-authenticates
            if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
                this.cookieCache.delete(instance.id);
                logger.info('[Adapter:qbittorrent] Auth failed, cleared cookie cache');
            }

            logger.error(`[Adapter:qbittorrent] Failed: error="${axiosError.message}" status=${axiosError.response?.status}`);

            return {
                success: false,
                error: axiosError.message,
                status: axiosError.response?.status || 500,
            };
        }
    }
}
