/**
 * Integration Schemas Route
 *
 * Returns all plugin schemas for frontend form auto-generation.
 * P4 Phase 4.4: Dynamic Forms
 */

import { Router } from 'express';
import { plugins } from '../../integrations/registry';

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
        configSchema: unknown;
        hasCustomForm: boolean;
        metrics?: { key: string }[];
    }> = {};

    for (const plugin of plugins) {
        schemas[plugin.id] = {
            name: plugin.name,
            description: plugin.description,
            category: plugin.category,
            configSchema: plugin.configSchema,
            hasCustomForm: plugin.hasCustomForm ?? false,
            metrics: plugin.metrics?.map(m => ({ key: m.key })),
        };
    }

    res.json({ schemas });
});

export default router;
