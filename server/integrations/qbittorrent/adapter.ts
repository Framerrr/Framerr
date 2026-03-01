/**
 * qBittorrent Adapter
 * 
 * Extends BaseAdapter with cookie-based authentication lifecycle.
 * qBittorrent uses session cookies (SID) instead of API keys.
 * 
 * Auth flow:
 *   1. POST /api/v2/auth/login with username/password → receive SID cookie
 *   2. Attach Cookie: SID=xxx header to all subsequent requests
 *   3. Cache SID with 5-minute TTL
 *   4. On AUTH_FAILED → clear cache, re-login, retry once
 * 
 * Cookie cache and login lock are shared across poller, proxy, and any
 * future callers since they all go through this singleton adapter.
 */

import { AxiosResponse } from 'axios';
import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance, TestResult } from '../types';
import { HttpOpts } from '../httpTypes';
import { AdapterError, extractAdapterErrorMessage } from '../errors';
import logger from '../../utils/logger';

// ============================================================================
// QBITTORRENT ADAPTER
// ============================================================================

interface CachedCookie {
    sid: string;
    timestamp: number;
}

export class QBittorrentAdapter extends BaseAdapter {
    readonly testEndpoint = '/api/v2/app/version';

    // Cache SID cookies per instance ID with TTL
    private cookieCache: Map<string, CachedCookie> = new Map();
    // Lock to prevent simultaneous logins for same instance
    private loginLocks: Map<string, Promise<string>> = new Map();
    // Cookie TTL: 5 minutes
    private readonly COOKIE_TTL_MS = 5 * 60 * 1000;

    getAuthHeaders(_instance: PluginInstance): Record<string, string> {
        // Cookie auth is injected in get()/post(), not via headers
        return {};
    }

    validateConfig(instance: PluginInstance): boolean {
        // Only URL is required — username/password are optional (auth can be disabled)
        return !!instance.config.url;
    }

    // ========================================================================
    // COOKIE LIFECYCLE (private)
    // ========================================================================

    /**
     * Get cached SID if still valid (within TTL).
     */
    private getCachedCookie(instanceId: string): string | null {
        const cached = this.cookieCache.get(instanceId);
        if (cached && Date.now() - cached.timestamp < this.COOKIE_TTL_MS) {
            return cached.sid;
        }
        // Expired or not found — clean up
        this.cookieCache.delete(instanceId);
        return null;
    }

    /**
     * Login to qBittorrent and cache the SID cookie.
     * Uses a lock to prevent multiple simultaneous logins for the same instance.
     */
    private async login(instance: PluginInstance): Promise<string> {
        const instanceId = instance.id;

        // Check if another request is already logging in
        const existingLogin = this.loginLocks.get(instanceId);
        if (existingLogin) {
            logger.debug('[Adapter:qbittorrent] Waiting for existing login...');
            return existingLogin;
        }

        const loginPromise = (async () => {
            const baseUrl = this.getBaseUrl(instance);
            const username = (instance.config.username as string) || '';
            const password = (instance.config.password as string) || '';

            logger.debug(`[Adapter:qbittorrent] Logging in: instance=${instanceId}`);

            // Use super.post() to get structured error handling, but we need to
            // build the request manually since login uses form-urlencoded body
            // and doesn't need cookie auth itself.
            const response = await super.post(
                instance,
                '/api/v2/auth/login',
                `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 10000,
                }
            );

            // qBittorrent returns "Fails." on bad credentials
            if (response.data === 'Fails.') {
                throw new AdapterError('AUTH_FAILED',
                    'Authentication failed — check username/password',
                    { instanceId, type: 'qbittorrent' }
                );
            }

            // Extract SID from Set-Cookie header
            const setCookies = response.headers['set-cookie'] || [];
            let sid = '';
            for (const cookie of setCookies) {
                const match = cookie.match(/SID=([^;]+)/);
                if (match) {
                    sid = match[1];
                    break;
                }
            }

            if (!sid) {
                throw new AdapterError('AUTH_FAILED',
                    'Login succeeded but no SID cookie received',
                    { instanceId, type: 'qbittorrent' }
                );
            }

            this.cookieCache.set(instanceId, { sid, timestamp: Date.now() });
            logger.debug(`[Adapter:qbittorrent] Login successful, SID cached: instance=${instanceId}`);
            return sid;
        })();

        // Store the promise so concurrent requests can wait on it
        this.loginLocks.set(instanceId, loginPromise);

        try {
            return await loginPromise;
        } finally {
            this.loginLocks.delete(instanceId);
        }
    }

    /**
     * Get a valid SID — from cache or via fresh login.
     * Returns empty string if no credentials configured (auth disabled).
     */
    private async ensureCookie(instance: PluginInstance): Promise<string> {
        const username = instance.config.username as string | undefined;
        const password = instance.config.password as string | undefined;

        // No credentials → no auth needed (qBittorrent auth disabled)
        if (!username && !password) {
            return '';
        }

        // Check cache first
        const cached = this.getCachedCookie(instance.id);
        if (cached) {
            return cached;
        }

        // Login fresh
        return this.login(instance);
    }

    /**
     * Build Cookie header opts for a request.
     * Returns opts with Cookie header merged in, or original opts if no cookie needed.
     */
    private buildCookieOpts(sid: string, opts?: HttpOpts): HttpOpts {
        if (!sid) {
            return opts || {};
        }
        return {
            ...opts,
            headers: {
                ...opts?.headers,
                'Cookie': `SID=${sid}`,
            },
        };
    }

    // ========================================================================
    // HTTP METHOD OVERRIDES (cookie injection + retry on auth failure)
    // ========================================================================

    /**
     * Override get() — inject cookie, retry on auth failure.
     */
    async get(instance: PluginInstance, path: string, opts?: HttpOpts): Promise<AxiosResponse> {
        // Skip cookie auth for login endpoint
        if (path === '/api/v2/auth/login') {
            return super.get(instance, path, opts);
        }

        const sid = await this.ensureCookie(instance);
        try {
            return await super.get(instance, path, this.buildCookieOpts(sid, opts));
        } catch (error) {
            // Retry once on auth failure
            if (error instanceof AdapterError && error.code === 'AUTH_FAILED') {
                logger.debug(`[Adapter:qbittorrent] Auth failed on GET ${path}, re-logging in`);
                this.cookieCache.delete(instance.id);
                const freshSid = await this.login(instance);
                return super.get(instance, path, this.buildCookieOpts(freshSid, opts));
            }
            throw error;
        }
    }

    /**
     * Override post() — inject cookie, retry on auth failure.
     */
    async post(instance: PluginInstance, path: string, body?: unknown, opts?: HttpOpts): Promise<AxiosResponse> {
        // Skip cookie auth for login endpoint
        if (path === '/api/v2/auth/login') {
            return super.post(instance, path, body, opts);
        }

        const sid = await this.ensureCookie(instance);
        try {
            return await super.post(instance, path, body, this.buildCookieOpts(sid, opts));
        } catch (error) {
            // Retry once on auth failure
            if (error instanceof AdapterError && error.code === 'AUTH_FAILED') {
                logger.debug(`[Adapter:qbittorrent] Auth failed on POST ${path}, re-logging in`);
                this.cookieCache.delete(instance.id);
                const freshSid = await this.login(instance);
                return super.post(instance, path, body, this.buildCookieOpts(freshSid, opts));
            }
            throw error;
        }
    }

    // ========================================================================
    // TEST CONNECTION (custom — login + version fetch)
    // ========================================================================

    /**
     * Override testConnection — qBittorrent needs login before fetching version.
     */
    async testConnection(config: Record<string, unknown>): Promise<TestResult> {
        const tempInstance: PluginInstance = {
            id: 'test',
            type: 'qbittorrent',
            name: 'Test',
            config,
        };

        try {
            // This will trigger login via ensureCookie(), then fetch version
            const response = await this.get(tempInstance, this.testEndpoint, { timeout: 5000 });
            const version = typeof response.data === 'string' ? response.data : undefined;
            return {
                success: true,
                message: 'Connection successful',
                version: version || 'Unknown',
            };
        } catch (error) {
            return {
                success: false,
                error: extractAdapterErrorMessage(error),
            };
        } finally {
            // Clean up temp instance from cache
            this.cookieCache.delete('test');
        }
    }
}
