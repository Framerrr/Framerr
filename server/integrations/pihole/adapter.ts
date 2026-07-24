import { AxiosResponse } from 'axios';
import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance, TestResult } from '../types';
import { HttpOpts } from '../httpTypes';
import { AdapterError, extractAdapterErrorMessage } from '../errors';
import logger from '../../utils/logger';

export type PiHoleVersion = 'v5' | 'v6';

interface PiHoleSession {
    sid: string;
    csrf?: string;
    expiresAt: number;
}

function asNonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export class PiHoleAdapter extends BaseAdapter {
    readonly testEndpoint = '/admin/api.php?status';

    private versionCache = new Map<string, PiHoleVersion>();
    private sessionCache = new Map<string, PiHoleSession>();

    getCachedVersion(instanceId: string): PiHoleVersion | undefined {
        return this.versionCache.get(instanceId);
    }

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        const version = this.versionCache.get(instance.id);
        if (version === 'v6') {
            const session = this.sessionCache.get(instance.id);
            if (session?.sid) {
                return { 'X-FTL-SID': session.sid };
            }
        }
        return {};
    }

    validateConfig(instance: PluginInstance): boolean {
        return !!asNonEmptyString(instance.config.url) && !!asNonEmptyString(instance.config.password);
    }

    protected parseTestResponse(data: unknown): { version?: string } {
        const record = data as Record<string, unknown> | null;
        if (!record) return {};

        if (typeof record.version === 'string') {
            return { version: record.version };
        }

        if (record.version && typeof record.version === 'object') {
            const versionObj = record.version as Record<string, unknown>;
            if (typeof versionObj.local === 'string') {
                return { version: versionObj.local as string };
            }
        }

        return {};
    }

    async testConnection(config: Record<string, unknown>): Promise<TestResult> {
        if (!asNonEmptyString(config.url)) {
            return { success: false, error: 'Pi-hole URL is required' };
        }
        if (!asNonEmptyString(config.password)) {
            return {
                success: false,
                error: 'Pi-hole password is required (use an application password on v6)',
            };
        }

        try {
            return await super.testConnection(config);
        } catch (error) {
            return {
                success: false,
                error: extractAdapterErrorMessage(error),
            };
        }
    }

    private async ensureV6Session(instance: PluginInstance): Promise<PiHoleSession> {
        const cached = this.sessionCache.get(instance.id);
        if (cached && cached.expiresAt > Date.now()) {
            return cached;
        }

        const password = asNonEmptyString(instance.config.password);
        if (!password) {
            throw new AdapterError('CONFIG_INVALID', 'Pi-hole password is required for authentication', {
                instanceId: instance.id,
                type: instance.type,
            });
        }

        const response = await super.request(instance, 'POST', '/api/auth', {
            password,
        });

        const session = (response.data as { session?: { sid?: string; csrf?: string; validity?: number } }).session;
        if (!session?.sid) {
            throw new AdapterError('AUTH_FAILED', 'Pi-hole v6 authentication did not return a session ID', {
                instanceId: instance.id,
                type: instance.type,
            });
        }

        const validitySeconds = session.validity && session.validity > 0 ? session.validity : 1800;
        const nextSession: PiHoleSession = {
            sid: session.sid,
            csrf: session.csrf,
            expiresAt: Date.now() + validitySeconds * 1000 - 30_000,
        };

        this.sessionCache.set(instance.id, nextSession);
        return nextSession;
    }

    private async detectVersion(instance: PluginInstance): Promise<PiHoleVersion> {
        try {
            await this.ensureV6Session(instance);
            this.versionCache.set(instance.id, 'v6');
            logger.info(`[PiHoleAdapter] Detected Pi-hole v6 for instance ${instance.id}`);
            return 'v6';
        } catch (err) {
            const status =
                err instanceof AdapterError && typeof err.context?.status === 'number'
                    ? err.context.status
                    : (err as { response?: { status?: number } }).response?.status;

            if (status === 404 || status === 501) {
                this.versionCache.set(instance.id, 'v5');
                logger.info(
                    `[PiHoleAdapter] Detected Pi-hole v5 for instance ${instance.id} (v6 auth path 404/501)`
                );
                return 'v5';
            }

            throw err;
        }
    }

    async request(
        instance: PluginInstance,
        method: string,
        path: string,
        body?: unknown,
        opts?: HttpOpts
    ): Promise<AxiosResponse> {
        let cachedVersion = this.versionCache.get(instance.id);

        if (!cachedVersion) {
            cachedVersion = await this.detectVersion(instance);
        }

        if (cachedVersion === 'v6') {
            await this.ensureV6Session(instance);
            const v6Path = this.translatePathV6(path);
            const session = this.sessionCache.get(instance.id);
            const headers: Record<string, string> = {
                ...opts?.headers,
                ...this.getAuthHeaders(instance),
            };

            if (session?.csrf && method.toUpperCase() !== 'GET') {
                headers['X-FTL-CSRF'] = session.csrf;
            }

            try {
                return await super.request(instance, method, v6Path, body, {
                    ...opts,
                    headers,
                });
            } catch (err) {
                if (err instanceof AdapterError && err.code === 'AUTH_FAILED') {
                    this.sessionCache.delete(instance.id);
                    await this.ensureV6Session(instance);
                    return super.request(instance, method, v6Path, body, {
                        ...opts,
                        headers: {
                            ...opts?.headers,
                            ...this.getAuthHeaders(instance),
                        },
                    });
                }
                throw err;
            }
        }

        const password = asNonEmptyString(instance.config.password);
        if (!password) {
            throw new AdapterError('CONFIG_INVALID', 'Pi-hole password is required for authentication', {
                instanceId: instance.id,
                type: instance.type,
            });
        }

        const v5Path = this.translatePathV5(path);
        return super.request(instance, method, v5Path, body, {
            ...opts,
            params: { ...opts?.params, auth: password },
        });
    }

    private translatePathV6(path: string): string {
        if (path.includes('/admin/api.php')) {
            const params = new URLSearchParams(path.split('?')[1] ?? '');
            if (params.has('summary') || params.has('summaryRaw')) return '/api/stats/summary';
            // v6 has no /api/stats/top_blocked — use top_domains (?blocked=true via caller params)
            if (params.has('topItems')) return '/api/stats/top_domains';
            if (params.has('status')) return '/api/stats/summary';
            if (params.has('enable')) return '/api/dns/blocking';
            if (params.has('disable')) return '/api/dns/blocking';
        }
        // Legacy mistaken path from early plan drafts
        if (path.includes('/api/stats/top_blocked')) {
            return '/api/stats/top_domains';
        }
        return path;
    }

    private translatePathV5(path: string): string {
        if (path.startsWith('/api/')) {
            if (path.includes('/api/stats/summary')) return '/admin/api.php?summaryRaw';
            if (path.includes('/api/stats/top_domains') || path.includes('/api/stats/top_blocked')) {
                return '/admin/api.php?topItems=10';
            }
            if (path.includes('/api/stats/top_clients')) return '/admin/api.php?getQuerySources';
            if (path.includes('/api/stats/upstreams')) return '/admin/api.php?getForwardDestinations';
            if (path.includes('/api/history')) return '/admin/api.php?overTimeData10mins';
            if (path.includes('/api/dns/status')) return '/admin/api.php?status';
            // Status probe for v6; on v5 use summaryRaw status instead of bare /admin/api.php
            if (path.includes('/api/dns/blocking') && !path.includes('?')) {
                return '/admin/api.php?status';
            }
            if (path.includes('/api/dns/blocking')) return '/admin/api.php';
        }
        return path;
    }
}
