/**
 * Base Adapter — Abstract HTTP Client for All Integrations
 * 
 * Every integration adapter extends this class. It provides:
 * - Centralized HTTP methods (get, post, request)
 * - Config validation before every request
 * - Structured error classification (AdapterError)
 * - Built-in testConnection() (eliminates standalone test.ts files)
 * - Consistent structured logging
 * - execute() wrapper for ProxyResult compatibility
 * 
 * Simple integrations override just 3 things:
 *   testEndpoint, getAuthHeaders(), validateConfig()
 * 
 * Complex integrations (Jellyfin reauth, qBittorrent cookies)
 * can override get()/post() for custom behavior.
 * 
 * @module server/integrations/BaseAdapter
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import http from 'http';
import { httpsAgent } from '../utils/httpsAgent';
import { translateHostUrl } from '../utils/urlHelper';
import logger from '../utils/logger';
import { PluginAdapter, PluginInstance, ProxyRequest, ProxyResult, TestResult } from './types';
import { HttpOpts } from './httpTypes';
import { AdapterError, classifyError, extractAdapterErrorMessage } from './errors';

// ============================================================================
// BASE ADAPTER
// ============================================================================

export abstract class BaseAdapter implements PluginAdapter {
    // --- Integration declares these ---

    /** Endpoint to call for testConnection (e.g., '/api/v3/system/status') */
    abstract readonly testEndpoint: string;

    // --- Integration overrides these ---

    /** Return auth headers for requests. Every adapter MUST override this. */
    abstract getAuthHeaders(instance: PluginInstance): Record<string, string>;

    // --- Defaults (can be overridden) ---

    /**
     * Validate that the instance has required config fields.
     * Default: requires config.url to be truthy.
     * Override for integrations needing additional fields (e.g., apiKey).
     */
    validateConfig(instance: PluginInstance): boolean {
        return !!instance.config.url;
    }

    /**
     * Get the base URL for requests.
     * Default: translateHostUrl(config.url) for Docker compatibility.
     */
    getBaseUrl(instance: PluginInstance): string {
        const url = instance.config.url as string;
        return translateHostUrl(url);
    }

    /**
     * Parse the test connection response to extract version info.
     * Default: looks for data.version.
     * Override for non-standard response shapes.
     */
    protected parseTestResponse(data: unknown): { version?: string } {
        const obj = data as Record<string, unknown> | null;
        return { version: obj?.version as string | undefined };
    }

    // ========================================================================
    // CORE HTTP METHODS (throw AdapterError on failure)
    // ========================================================================

    /**
     * HTTP GET request through the adapter.
     * Throws AdapterError on failure.
     */
    async get(instance: PluginInstance, path: string, opts?: HttpOpts): Promise<AxiosResponse> {
        return this.request(instance, 'GET', path, undefined, opts);
    }

    /**
     * HTTP POST request through the adapter.
     * Throws AdapterError on failure.
     */
    async post(instance: PluginInstance, path: string, body?: unknown, opts?: HttpOpts): Promise<AxiosResponse> {
        return this.request(instance, 'POST', path, body, opts);
    }

    /**
     * Core HTTP request method. All other methods route through here.
     * Validates config, builds URL + headers, calls axios, classifies errors.
     * 
     * @throws AdapterError on any failure
     */
    async request(
        instance: PluginInstance,
        method: string,
        path: string,
        body?: unknown,
        opts?: HttpOpts
    ): Promise<AxiosResponse> {
        // Config validation before every request
        if (!this.validateConfig(instance)) {
            throw new AdapterError('CONFIG_INVALID',
                `Missing required configuration for ${instance.type}`,
                { instanceId: instance.id, type: instance.type }
            );
        }

        const baseUrl = this.getBaseUrl(instance);
        const authHeaders = this.getAuthHeaders(instance);
        const url = `${baseUrl}${path}`;

        const config: AxiosRequestConfig = {
            method,
            url,
            headers: {
                ...authHeaders,
                ...opts?.headers,
            },
            params: opts?.params,
            data: body,
            httpAgent: new http.Agent({ keepAlive: false }),
            httpsAgent,
            timeout: opts?.timeout ?? 15000,
            ...(opts?.responseType ? { responseType: opts.responseType } : {}),
        };

        logger.debug(`[Adapter:${instance.type}] ${method} ${path}`, { instanceId: instance.id });

        try {
            return await axios(config);
        } catch (error) {
            const adapterError = classifyError(error, instance.type);
            // Timeouts and network blips are warn-level (transient, expected in dev/cross-network)
            // Auth failures and server errors are error-level (actionable)
            const logLevel = adapterError.code === 'SERVICE_UNREACHABLE' || adapterError.code === 'NETWORK_ERROR'
                ? 'warn' : 'error';
            logger[logLevel](
                `[Adapter:${instance.type}] ${adapterError.code}: ${adapterError.message}`,
                { instanceId: instance.id, path, status: (error as { response?: { status: number } }).response?.status }
            );
            throw adapterError;
        }
    }

    // ========================================================================
    // WRAPPED METHODS (catch errors, return result objects)
    // ========================================================================

    /**
     * Execute a proxy request. Wraps request() with try/catch → ProxyResult.
     * Used by proxy routes and library sync.
     */
    async execute(instance: PluginInstance, request: ProxyRequest): Promise<ProxyResult> {
        try {
            const response = await this.request(
                instance,
                request.method,
                request.path,
                request.body,
                {
                    params: request.query,
                    timeout: request.timeout,
                }
            );
            return { success: true, data: response.data };
        } catch (error) {
            const status = error instanceof AdapterError && error.context?.status
                ? error.context.status as number
                : 500;
            return {
                success: false,
                error: extractAdapterErrorMessage(error),
                status,
            };
        }
    }

    /**
     * Test connectivity to the external service.
     * Creates a temporary instance from raw config and hits testEndpoint.
     * 
     * Eliminates the need for standalone test.ts files in most integrations.
     * Override for integrations with non-standard test flows (qBittorrent, Monitor).
     */
    async testConnection(config: Record<string, unknown>): Promise<TestResult> {
        const tempInstance: PluginInstance = {
            id: 'test',
            type: 'test',
            name: 'Test',
            config,
        };

        try {
            const response = await this.get(tempInstance, this.testEndpoint, { timeout: 5000 });
            const { version } = this.parseTestResponse(response.data);
            return {
                success: true,
                message: 'Connection successful',
                version,
            };
        } catch (error) {
            return {
                success: false,
                error: extractAdapterErrorMessage(error),
            };
        }
    }
}
