/**
 * Service Monitors Admin CRUD Routes
 * 
 * Admin-only endpoints for managing service monitors.
 * 
 * Endpoints:
 * - GET / - Get all monitors (supports instanceId filter)
 * - POST / - Create monitor
 * - POST /test - Test monitor config before saving
 * - PUT /reorder - Reorder monitors
 * - PUT /:id - Update monitor
 * - DELETE /:id - Delete monitor
 * - POST /:id/test - Test saved monitor
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import * as serviceMonitorsDb from '../../db/serviceMonitors';
import servicePoller from '../../services/servicePoller';
import logger from '../../utils/logger';

const router = Router();

/**
 * GET /
 * Get all monitors (admin only)
 * Supports filtering by instanceId query param
 */
router.get('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { instanceId } = req.query;
        let monitors;

        if (instanceId && typeof instanceId === 'string') {
            // Filter by integration instance ID
            monitors = await serviceMonitorsDb.getMonitorsByIntegrationInstance(instanceId);
        } else {
            // Return all monitors (legacy behavior)
            monitors = await serviceMonitorsDb.getAllMonitors();
        }

        res.json({ monitors });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to list: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch monitors' });
    }
});

/**
 * POST /
 * Create a new monitor (admin only)
 */
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { name, iconId, iconName, type, url, port, intervalSeconds, timeoutSeconds, retries,
            degradedThresholdMs, expectedStatusCodes, enabled, orderIndex,
            notifyDown, notifyUp, notifyDegraded, maintenanceSchedule, integrationInstanceId, sourceIntegrationId } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }

        const monitor = await serviceMonitorsDb.createMonitor(req.user!.id, {
            name,
            iconId,
            iconName,
            type,
            url,
            port,
            intervalSeconds,
            timeoutSeconds,
            retries,
            degradedThresholdMs,
            expectedStatusCodes,
            enabled,
            orderIndex,
            notifyDown,
            notifyUp,
            notifyDegraded,
            maintenanceSchedule,
            integrationInstanceId,
            sourceIntegrationId,
        });

        // Add to polling loop if enabled
        if (monitor.enabled) {
            servicePoller.addMonitor(monitor);
        }

        res.status(201).json({ monitor });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to create: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to create monitor' });
    }
});

/**
 * POST /test
 * Test a monitor config before saving (admin only)
 * Used for testing unsaved/new monitors
 */
router.post('/test', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { url, host, port, type, timeout_seconds, expected_status_codes } = req.body;

        // Create temporary monitor object for testing
        const testMonitor: serviceMonitorsDb.ServiceMonitor = {
            id: 'test-temp',
            ownerId: req.user!.id,
            name: 'Test',
            iconId: null,
            iconName: null,
            type: type || 'http',
            url: url || null,
            port: port || null,
            intervalSeconds: 60,
            timeoutSeconds: timeout_seconds || 10,
            retries: 3,
            degradedThresholdMs: 2000,
            expectedStatusCodes: (() => {
                if (!expected_status_codes) return ['200-299'];
                if (Array.isArray(expected_status_codes)) return expected_status_codes;
                if (typeof expected_status_codes === 'string') {
                    return expected_status_codes.split(',').map((s: string) => s.trim());
                }
                return ['200-299'];
            })(),
            enabled: true,
            maintenance: false,
            uptimeKumaId: null,
            uptimeKumaUrl: null,
            isReadonly: false,
            notifyDown: false,
            notifyUp: false,
            notifyDegraded: false,
            maintenanceSchedule: null,
            integrationInstanceId: null,
            sourceIntegrationId: null,
            orderIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = await servicePoller.testMonitor(testMonitor);

        res.json({
            success: result.status !== 'down',
            status: result.status,
            response_time_ms: result.responseTimeMs,
            statusCode: result.statusCode,
            error: result.errorMessage,
        });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to test config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to test monitor' });
    }
});

/**
 * PUT /reorder
 * Reorder monitors (admin only)
 */
router.put('/reorder', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { orderedIds } = req.body;

        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
            res.status(400).json({ error: 'orderedIds array is required' });
            return;
        }

        serviceMonitorsDb.reorderMonitors(orderedIds);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to reorder: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to reorder monitors' });
    }
});

/**
 * PUT /:id
 * Update a monitor (admin only)
 */
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, iconId, iconName, type, url, port, intervalSeconds, timeoutSeconds, retries,
            degradedThresholdMs, expectedStatusCodes, enabled, orderIndex,
            notifyDown, notifyUp, notifyDegraded, maintenanceSchedule } = req.body;

        const monitor = await serviceMonitorsDb.updateMonitor(id, {
            name,
            iconId,
            iconName,
            type,
            url,
            port,
            intervalSeconds,
            timeoutSeconds,
            retries,
            degradedThresholdMs,
            expectedStatusCodes,
            enabled,
            orderIndex,
            notifyDown,
            notifyUp,
            notifyDegraded,
            maintenanceSchedule,
        });

        if (!monitor) {
            res.status(404).json({ error: 'Monitor not found' });
            return;
        }

        // Update polling loop
        await servicePoller.updateMonitor(monitor);

        res.json({ monitor });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to update: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update monitor' });
    }
});

/**
 * DELETE /:id
 * Delete a monitor (admin only)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Remove from polling loop first
        servicePoller.removeMonitor(id);

        const success = await serviceMonitorsDb.deleteMonitor(id);
        if (!success) {
            res.status(404).json({ error: 'Monitor not found' });
            return;
        }

        res.json({ success: true });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to delete: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to delete monitor' });
    }
});

/**
 * POST /:id/test
 * Test a monitor immediately (admin only)
 */
router.post('/:id/test', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const monitor = await serviceMonitorsDb.getMonitorById(id);

        if (!monitor) {
            res.status(404).json({ error: 'Monitor not found' });
            return;
        }

        const result = await servicePoller.testMonitor(monitor);

        res.json({
            success: result.status !== 'down',
            status: result.status,
            responseTimeMs: result.responseTimeMs,
            statusCode: result.statusCode,
            errorMessage: result.errorMessage,
        });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to test: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to test monitor' });
    }
});

export default router;
