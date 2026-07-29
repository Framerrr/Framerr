/**
 * qBittorrent Adapter
 *
 * Extends BaseAdapter with cookie-based authentication lifecycle.
 * qBittorrent uses session cookies instead of API keys.
 *
 * Auth flow:
 *   1. POST /api/v2/auth/login with username/password → session cookie
 *   2. Attach Cookie: <name>=<value> on subsequent requests
 *   3. Cache cookie with 5-minute TTL
 *   4. On AUTH_FAILED → clear cache, re-login, retry once
 *
 * Cookie names:
 *   - Pre-5.2: `SID`
 *   - 5.2+: `QBT_SID_<webui-port>` (and optional custom names matching SID*)
 * Login success:
 *   - Pre-5.2: HTTP 200 + body "Ok."
 *   - 5.2+: HTTP 204 + empty body
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
// SESSION COOKIE PARSING
// ============================================================================

export interface QbSessionCookie {
    name: string;
    value: string;
}

/**
 * Extract qBittorrent WebUI session cookie from Set-Cookie header(s).
 * Supports legacy `SID` and 5.2+ `QBT_SID_<port>` (also custom SID* names).
 */
export function parseQbittorrentSessionCookie(
    setCookieHeader: string | string[] | undefined
): QbSessionCookie | null {
    if (!setCookieHeader) return null;
    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

    let legacy: QbSessionCookie | null = null;
    for (const cookie of headers) {
        // SID=… | QBT_SID=… | QBT_SID_8080=…
        const match = cookie.match(/((?:QBT_)?SID[^=]*)=([^;]+)/i);
        if (!match) continue;
        const parsed = { name: match[1], value: match[2] };
        if (parsed.name.toUpperCase().startsWith('QBT_')) {
            return parsed;
        }
        legacy = parsed;
    }
    return legacy;
}

// ============================================================================
// QBITTORRENT ADAPTER
// ============================================================================

interface CachedCookie extends QbSessionCookie {
    timestamp: number;
}

export class QBittorrentAdapter extends BaseAdapter {
    readonly testEndpoint = '/api/v2/app/version';

    // Cache session cookies per instance ID with TTL
    private cookieCache: Map<string, CachedCookie> = new Map();
    // Lock to prevent simultaneous logins for same instance
    private loginLocks: Map<string, Promise<QbSessionCookie>> = new Map();
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
     * Get cached session cookie if still valid (within TTL).
     */
    private getCachedCookie(instanceId: string): QbSessionCookie | null {
        const cached = this.cookieCache.get(instanceId);
        if (cached && Date.now() - cached.timestamp < this.COOKIE_TTL_MS) {
            return { name: cached.name, value: cached.value };
        }
        // Expired or not found — clean up
        this.cookieCache.delete(instanceId);
        return null;
    }

    /**
     * Login to qBittorrent and cache the session cookie.
     * Uses a lock to prevent multiple simultaneous logins for the same instance.
     */
    private async login(instance: PluginInstance): Promise<QbSessionCookie> {
        const instanceId = instance.id;

        // Check if another request is already logging in
        const existingLogin = this.loginLocks.get(instanceId);
        if (existingLogin) {
            logger.debug('[Adapter:qbittorrent] Waiting for existing login...');
            return existingLogin;
        }

        const loginPromise = (async (): Promise<QbSessionCookie> => {
            const username = (instance.config.username as string) || '';
            const password = (instance.config.password as string) || '';

            logger.debug(`[Adapter:qbittorrent] Logging in: instance=${instanceId}`);

            // Login uses form-urlencoded body and does not need cookie auth itself.
            const response = await super.post(
                instance,
                '/api/v2/auth/login',
                `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 10000,
                    // Pre-5.2: 200 + "Ok."; 5.2+: 204 empty — both are 2xx (axios default).
                }
            );

            // Pre-5.2 bad credentials: 200 + "Fails."
            if (response.data === 'Fails.') {
                throw new AdapterError('AUTH_FAILED',
                    'Authentication failed — check username/password',
                    { instanceId, type: 'qbittorrent' }
                );
            }

            const session = parseQbittorrentSessionCookie(response.headers['set-cookie']);
            if (!session) {
                throw new AdapterError('AUTH_FAILED',
                    'Login succeeded but no session cookie received',
                    { instanceId, type: 'qbittorrent' }
                );
            }

            this.cookieCache.set(instanceId, {
                name: session.name,
                value: session.value,
                timestamp: Date.now(),
            });
            logger.debug(
                `[Adapter:qbittorrent] Login successful, cookie cached: instance=${instanceId} name=${session.name}`
            );
            return session;
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
     * Get a valid session cookie — from cache or via fresh login.
     * Returns null if no credentials configured (auth disabled).
     */
    private async ensureCookie(instance: PluginInstance): Promise<QbSessionCookie | null> {
        const username = instance.config.username as string | undefined;
        const password = instance.config.password as string | undefined;

        // No credentials → no auth needed (qBittorrent auth disabled)
        if (!username && !password) {
            return null;
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
    private buildCookieOpts(session: QbSessionCookie | null, opts?: HttpOpts): HttpOpts {
        if (!session) {
            return opts || {};
        }
        return {
            ...opts,
            headers: {
                ...opts?.headers,
                Cookie: `${session.name}=${session.value}`,
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

        const session = await this.ensureCookie(instance);
        try {
            return await super.get(instance, path, this.buildCookieOpts(session, opts));
        } catch (error) {
            // Retry once on auth failure
            if (error instanceof AdapterError && error.code === 'AUTH_FAILED') {
                logger.debug(`[Adapter:qbittorrent] Auth failed on GET ${path}, re-logging in`);
                this.cookieCache.delete(instance.id);
                const fresh = await this.login(instance);
                return super.get(instance, path, this.buildCookieOpts(fresh, opts));
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

        const session = await this.ensureCookie(instance);
        try {
            return await super.post(instance, path, body, this.buildCookieOpts(session, opts));
        } catch (error) {
            // Retry once on auth failure
            if (error instanceof AdapterError && error.code === 'AUTH_FAILED') {
                logger.debug(`[Adapter:qbittorrent] Auth failed on POST ${path}, re-logging in`);
                this.cookieCache.delete(instance.id);
                const fresh = await this.login(instance);
                return super.post(instance, path, body, this.buildCookieOpts(fresh, opts));
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
