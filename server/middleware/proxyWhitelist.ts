import { Request, Response, NextFunction, Application } from 'express';
import ipaddr from 'ipaddr.js';
import ipRangeCheck from 'ip-range-check';
import logger from '../utils/logger';

interface ProxyConfig {
    enabled?: boolean;
    headerName?: string;
    emailHeaderName?: string;
    whitelist?: string | string[];
}

interface SystemConfig {
    auth?: {
        proxy?: ProxyConfig;
    };
}

/**
 * Proxy Whitelist Middleware
 * 
 * Validates that proxy auth headers (from Authentik/Authelia) come from a trusted IP range.
 * Prevents header spoofing attacks.
 */
export function validateProxyWhitelist() {
    return (req: Request, res: Response, next: NextFunction): void => {
        const app = req.app as Application & {
            get(key: 'systemConfig'): SystemConfig | undefined;
            get(key: 'proxyHeadersWarningLogged'): boolean | undefined;
            set(key: 'proxyHeadersWarningLogged', value: boolean): Application;
        };

        // Get proxy config early to check which headers to look for
        const systemConfig = app.get('systemConfig');
        const configuredHeader = (systemConfig?.auth?.proxy?.headerName || 'X-authentik-username').toLowerCase();
        const configuredEmailHeader = (systemConfig?.auth?.proxy?.emailHeaderName || 'X-authentik-email').toLowerCase();

        // Check if ANY proxy auth headers are present (configured header + common fallbacks)
        const hasProxyHeaders = req.headers[configuredHeader] ||
            req.headers['x-forwarded-user'] ||
            req.headers['remote-user'];

        if (!hasProxyHeaders) {
            next();
            return;
        }

        // Skip if proxy auth is disabled or no whitelist configured
        if (!systemConfig?.auth?.proxy?.enabled || !systemConfig?.auth?.proxy?.whitelist) {
            // Log once per session, not every request - use app flag
            if (!app.get('proxyHeadersWarningLogged')) {
                logger.debug('[ProxyAuth] Proxy headers detected but proxy auth not enabled - headers will be ignored');
                app.set('proxyHeadersWarningLogged', true);
            }
            // Remove ALL possible proxy headers to prevent spoofing
            delete req.headers[configuredHeader];
            delete req.headers[configuredEmailHeader];
            delete req.headers['x-authentik-username'];
            delete req.headers['x-authentik-email'];
            delete req.headers['x-forwarded-user'];
            delete req.headers['x-forwarded-email'];
            delete req.headers['remote-user'];
            delete req.headers['remote-email'];
            next();
            return;
        }

        // Get DIRECT connection IP - NOT req.ip which respects 'trust proxy' and returns forwarded client IP
        // For proxy auth, we need the IP of the reverse proxy (Authentik/NPM) that's injecting the auth headers
        let clientIp = req.socket.remoteAddress || req.connection.remoteAddress || '';

        // Normalize IPv6-mapped IPv4 addresses
        if (ipaddr.isValid(clientIp)) {
            try {
                const addr = ipaddr.parse(clientIp);
                if (addr.kind() === 'ipv6' && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
                    clientIp = (addr as ipaddr.IPv6).toIPv4Address().toString();
                }
            } catch (e) {
                logger.error(`[ProxyAuth] IP parsing error: error="${(e as Error).message}"`);
            }
        }

        // Check if IP is in whitelist
        const whitelist = Array.isArray(systemConfig.auth.proxy.whitelist)
            ? systemConfig.auth.proxy.whitelist
            : [systemConfig.auth.proxy.whitelist];

        const isWhitelisted = whitelist.some(range => {
            try {
                return ipRangeCheck(clientIp, range);
            } catch (e) {
                logger.error(`[ProxyAuth] Invalid IP range: ${range}`, { error: (e as Error).message });
                return false;
            }
        });

        if (!isWhitelisted) {
            // Log once per IP to avoid log spam (e.g., dev server on localhost)
            const blockedIps = (app as unknown as Record<string, Set<string>>)._blockedProxyIps ??= new Set();
            if (!blockedIps.has(clientIp)) {
                logger.warn(`[ProxyAuth] Blocked spoofed headers from ${clientIp} (not in whitelist)`);
                blockedIps.add(clientIp);
            }
            // Remove ALL possible proxy headers to prevent spoofing
            delete req.headers[configuredHeader];
            delete req.headers[configuredEmailHeader];
            delete req.headers['x-authentik-username'];
            delete req.headers['x-authentik-email'];
            delete req.headers['x-forwarded-user'];
            delete req.headers['x-forwarded-email'];
            delete req.headers['remote-user'];
            delete req.headers['remote-email'];
        }

        next();
    };
}
