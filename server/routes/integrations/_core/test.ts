/**
 * Integration Test Routes
 * 
 * Connection testing endpoints for all integration types.
 * Uses the plugin registry to dispatch to integration-specific test functions.
 * 
 * Endpoints:
 * - POST /test - Test with provided config (admin only)
 * - POST /:id/test - Test saved instance (admin only)
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../../middleware/auth';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import logger from '../../../utils/logger';
import { getPlugin } from '../../../integrations/registry';

const router = Router();

/**
 * POST /test
 * Test integration connection with provided config (ADMIN ONLY)
 * Used for testing before saving.
 */
router.post('/test', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { service, config } = req.body;

        if (!service || !config) {
            res.status(400).json({ error: 'Service and config required' });
            return;
        }

        const plugin = getPlugin(service);
        if (!plugin) {
            res.status(400).json({ error: `Unknown service type: ${service}` });
            return;
        }

        if (!plugin.testConnection) {
            res.status(400).json({ error: `No connection test available for: ${service}` });
            return;
        }

        const result = await plugin.testConnection(config);
        res.json(result);
    } catch (error) {
        logger.error(`[Integrations] Test failed: error="${(error as Error).message}"`);
        res.status(500).json({
            success: false,
            error: (error as Error).message || 'Test failed'
        });
    }
});

/**
 * POST /:id/test
 * Test a saved integration instance (ADMIN ONLY)
 */
router.post('/:id/test', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const instance = integrationInstancesDb.getInstanceById(req.params.id);

        if (!instance) {
            res.status(404).json({ error: 'Integration not found' });
            return;
        }

        const plugin = getPlugin(instance.type);
        if (!plugin || !plugin.testConnection) {
            res.status(400).json({ error: `No test available for type: ${instance.type}` });
            return;
        }

        const result = await plugin.testConnection(instance.config);
        res.json(result);
    } catch (error) {
        logger.error(`[Integrations] Test failed: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({
            success: false,
            error: (error as Error).message || 'Test failed'
        });
    }
});

export default router;

