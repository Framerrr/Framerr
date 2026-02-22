/**
 * Integration Schemas Route
 *
 * Returns all plugin schemas for frontend form auto-generation.
 * P4 Phase 4.4: Dynamic Forms
 */

import { Router } from 'express';
import { plugins } from '../../../integrations/registry';

const router = Router();

/**
 * GET /api/integrations/schemas
 * Returns all integration plugin schemas for form generation
 */
router.get('/schemas', (_req, res) => {
    const schemas: Record<string, {
        name: string;
        description: string;
        category: string;
        icon?: string;
        configSchema: unknown;
        hasCustomForm: boolean;
        hasConnectionTest: boolean;
        metrics?: Array<{ key: string; recordable: boolean }>;
        notificationMode?: 'webhook' | 'local';
        notificationEvents?: Array<{ key: string; label: string; category?: string; adminOnly?: boolean; defaultAdmin?: boolean; defaultUser?: boolean }>;
    }> = {};

    for (const plugin of plugins) {
        // Unify notification events: webhook plugins have events in webhook.events,
        // local plugins have events in notificationEvents
        const notificationEvents = plugin.notificationMode === 'webhook'
            ? plugin.webhook?.events
            : plugin.notificationEvents;

        schemas[plugin.id] = {
            name: plugin.name,
            description: plugin.description,
            category: plugin.category,
            icon: plugin.icon,
            configSchema: plugin.configSchema,
            hasCustomForm: plugin.hasCustomForm ?? false,
            hasConnectionTest: !!plugin.testConnection,
            metrics: plugin.metrics?.map(m => ({ key: m.key, recordable: m.recordable })),
            notificationMode: plugin.notificationMode,
            notificationEvents: notificationEvents?.map(e => ({
                key: e.key,
                label: e.label,
                category: e.category,
                adminOnly: e.adminOnly,
                defaultAdmin: e.defaultAdmin,
                defaultUser: e.defaultUser,
            })),
        };
    }

    res.json({ schemas });
});

export default router;
