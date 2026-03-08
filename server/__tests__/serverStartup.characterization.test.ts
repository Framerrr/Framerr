/**
 * Server Startup Characterization Tests
 * 
 * Behavior Lock: These tests lock the current behavior of the Express app
 * composition to detect any unintended changes during the server/index.ts split.
 * 
 * Plan reference: TASK-20260306-008_PLAN.md, Behavior Lock Strategy
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { createServer, Server } from 'http';
import fs from 'fs';
import path from 'path';

// Import the app from the new module
import { app, version } from '../app';

// The exact set of 36 route base paths, in registration order.
// This is the deterministic contract — any change must be intentional.
const EXPECTED_ROUTE_BASES = [
    '/api/auth/setup',
    '/api/auth',
    '/api/profile',
    '/api/config',
    '/api/admin',
    '/api/system',
    '/api/integrations',
    '/api/tabs',
    '/api/tab-groups',
    '/api/widgets',
    '/api/theme',
    '/api/backup',
    '/api/custom-icons',
    '/api/advanced',
    '/api/diagnostics',
    '/api/notifications',
    '/api/plex',
    '/api/auth/sso-setup',
    '/api/auth/oidc',
    '/api/linked-accounts',
    '/api/admin/oidc',
    '/api/webhooks',
    '/api/request-actions',
    '/api/templates',
    '/api/realtime',
    '/api/service-monitors',
    '/api/widget-shares',
    '/api/user-groups',
    '/api/cache',
    '/api/media',
    '/api/jobs',
    '/api/icons',
    '/api/metric-history',
    '/api/media/recommendations',
    '/api/walkthrough',
    '/api/link-library',
];

describe('Server Startup Characterization', () => {
    // --- Test #1: Middleware mounting order unchanged ---
    it('locks exact middleware layer sequence', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stack = (app as any)._router.stack;
        const layerNames = stack
            .map((layer: { name: string }) => layer.name)
            .filter((name: string) => name !== '<anonymous>' && name !== 'bound dispatch' && name !== 'router');

        // Snapshot locks the exact sequence. Any reordering, addition,
        // or removal fails deterministically.
        expect(layerNames).toMatchSnapshot();
    });

    // --- Test #2: All 36 routes registered at exact paths ---
    it('locks exact route mount set', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stack = (app as any)._router.stack;
        const routeBases = stack
            .filter((layer: { name: string; regexp: RegExp; route?: unknown }) =>
                layer.name === 'router' && layer.regexp
            )
            .map((layer: { regexp: { source: string } }) => {
                // Extract the path from the regexp source
                // Express stores mount paths as regexps like /^\/api\/auth\/?(?=\/|$)/i
                const source = layer.regexp.source;
                return source
                    .replace(/^\^\\\//, '/')     // Remove ^\/
                    .replace(/\\\//g, '/')        // Unescape slashes
                    .replace(/\/?\?\(.*$/, '')   // Remove trailing /?(?=\/|$)
                    .replace(/\\\-/g, '-');       // Unescape dashes
            });

        expect(routeBases).toEqual(EXPECTED_ROUTE_BASES);
    });

    // --- Test #3: Route-order-sensitive families preserved ---
    it('verifies auth route ordering', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stack = (app as any)._router.stack;
        const routeBases = stack
            .filter((layer: { name: string }) => layer.name === 'router')
            .map((layer: { regexp: { source: string } }) => {
                const source = layer.regexp.source;
                return source
                    .replace(/^\^\\\//, '/')
                    .replace(/\\\//g, '/')
                    .replace(/\/?\?\(.*$/, '')
                    .replace(/\\\-/g, '-');
            });

        const setupIndex = routeBases.indexOf('/api/auth/setup');
        const authIndex = routeBases.indexOf('/api/auth');

        expect(setupIndex).toBeGreaterThanOrEqual(0);
        expect(authIndex).toBeGreaterThanOrEqual(0);
        // /api/auth/setup MUST come before /api/auth
        expect(setupIndex).toBeLessThan(authIndex);
    });

    // --- Test #4: Express app exports correctly ---
    it('exports app and version', () => {
        expect(app).toBeDefined();
        expect(typeof app.use).toBe('function');
        expect(typeof app.get).toBe('function');
        expect(typeof app.listen).toBe('function');
        expect(version).toBeDefined();
        expect(typeof version).toBe('string');
        expect(version.length).toBeGreaterThan(0);
    });

    // --- Test #5: One-way module boundary ---
    it('no import cycle', () => {
        const appSource = fs.readFileSync(
            path.join(__dirname, '..', 'app.ts'),
            'utf-8'
        );
        // app.ts must never import from index.ts
        expect(appSource).not.toMatch(/from\s+['"]\.\/index['"]/);
        expect(appSource).not.toMatch(/require\s*\(\s*['"]\.\/index['"]\s*\)/);
    });

    // --- Test #6: All route bases respond without 404 ---
    // Verifies every mounted route base responds to HTTP requests.
    // Uses POST method because many routes only handle POST/PUT/DELETE
    // (no GET handler). POST to a mounted router returns auth errors
    // (401/403) or validation errors (400), NOT 404 — so any non-404
    // response confirms the router IS mounted and reachable.
    describe('all route bases respond without 404', () => {
        let server: Server;
        let baseUrl: string;

        beforeAll(async () => {
            server = createServer(app);
            await new Promise<void>((resolve) => {
                server.listen(0, () => {
                    const address = server.address();
                    if (address && typeof address !== 'string') {
                        baseUrl = `http://127.0.0.1:${address.port}`;
                    }
                    resolve();
                });
            });
        });

        afterAll(async () => {
            if (server) {
                await new Promise<void>((resolve) => {
                    server.close(() => resolve());
                });
            }
        });

        // Each route base should respond with something other than 404
        // (401/403 for auth-protected, 400 for bad body, etc. — all valid)
        for (const routeBase of EXPECTED_ROUTE_BASES) {
            it(`${routeBase} responds (not 404)`, async () => {
                const res = await fetch(`${baseUrl}${routeBase}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });
                expect(res.status).not.toBe(404);
            });
        }

        // Health endpoint specifically should return 200 on GET
        it('/api/health responds 200', async () => {
            const res = await fetch(`${baseUrl}/api/health`);
            expect(res.status).toBe(200);
            const body = await res.json() as { status: string; version: string };
            expect(body.status).toBe('healthy');
            expect(body.version).toBe(version);
        });
    });
});
