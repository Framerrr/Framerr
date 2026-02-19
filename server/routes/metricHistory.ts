/**
 * Metric History API Routes
 *
 * Provides endpoints for querying metric history data
 * and managing the metric history feature toggle.
 *
 * IMPORTANT: Route ordering matters! Static paths (status, toggle, availability, integration)
 * MUST be defined BEFORE the parameterized /:integrationId catch-all route.
 *
 * @module server/routes/metricHistory
 */

import { Router, Request, Response } from 'express';
import { metricHistoryService } from '../services/MetricHistoryService';
import { getSystemConfig, updateSystemConfig } from '../db/systemConfig';
import * as metricHistorySourcesDb from '../db/metricHistorySources';
import { getPlugin } from '../integrations/registry';
import * as integrationInstancesDb from '../db/integrationInstances';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { invalidateSystemSettings } from '../utils/invalidateUserSettings';
import logger from '../utils/logger';

const router = Router();

// ============================================================================
// STATUS & TOGGLE (must be before /:integrationId catch-all)
// ============================================================================

/**
 * GET /api/metric-history/status
 * Get current metric history status (enabled, storage stats).
 */
router.get('/status', requireAuth, async (_req: Request, res: Response) => {
    try {
        const config = await getSystemConfig();

        res.json({
            success: true,
            enabled: config.metricHistory?.enabled ?? false,
        });
    } catch (error) {
        logger.error(`[MetricHistory] Status check failed: ${(error as Error).message}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'STATUS_ERROR',
                message: 'Failed to get metric history status'
            }
        });
    }
});

/**
 * POST /api/metric-history/toggle
 * Enable or disable metric history recording.
 * Admin only. Disabling stops recording but preserves existing data.
 */
router.post('/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAM',
                    message: 'Missing or invalid parameter: enabled (boolean)'
                }
            });
            return;
        }

        // Update config in DB
        await updateSystemConfig({
            metricHistory: { enabled }
        });

        // Toggle the service
        if (enabled) {
            await metricHistoryService.enable();
            logger.info('[MetricHistory] Enabled via API toggle');
        } else {
            await metricHistoryService.disable();
            logger.info('[MetricHistory] Disabled via API toggle (data preserved)');
        }

        res.json({
            success: true,
            metricHistory: { enabled }
        });

        // Broadcast to all connected clients so widgets update in real-time
        invalidateSystemSettings('metric-history');
    } catch (error) {
        logger.error(`[MetricHistory] Toggle failed: ${(error as Error).message}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'TOGGLE_ERROR',
                message: 'Failed to toggle metric history'
            }
        });
    }
});

// ============================================================================
// AVAILABILITY (must be before /:integrationId catch-all)
// ============================================================================

/**
 * GET /api/metric-history/availability/:integrationId
 * Get per-metric source availability for an integration.
 * Returns source type (internal/external/none/pending), probe status, and data point counts.
 */
router.get('/availability/:integrationId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        if (!metricHistoryService.isEnabled()) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'FEATURE_DISABLED',
                    message: 'Metric history recording is not enabled'
                }
            });
            return;
        }

        const { integrationId } = req.params;
        const availability = metricHistorySourcesDb.getAvailability(integrationId);

        res.json({
            success: true,
            integrationId,
            metrics: availability,
        });
    } catch (error) {
        logger.error(`[MetricHistory] Availability check failed: ${(error as Error).message}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'AVAILABILITY_ERROR',
                message: 'Failed to get metric availability'
            }
        });
    }
});

// ============================================================================
// PER-INTEGRATION CONFIG (must be before /:integrationId catch-all)
// ============================================================================

/**
 * GET /api/metric-history/integration/:integrationId
 * Get per-integration metric history config (mode, retentionDays, availability).
 */
router.get('/integration/:integrationId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { integrationId } = req.params;
        const config = metricHistoryService.getIntegrationConfig(integrationId);

        const globalConfig = await getSystemConfig();
        const globalEnabled = globalConfig.metricHistory?.enabled ?? false;

        res.json({
            success: true,
            integrationId,
            globalEnabled,
            config,
        });
    } catch (error) {
        logger.error(`[MetricHistory] Get integration config failed: ${(error as Error).message}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'CONFIG_ERROR',
                message: 'Failed to get integration metric history config'
            }
        });
    }
});

/**
 * PUT /api/metric-history/integration/:integrationId
 * Update per-integration metric history config.
 * Admin only. Triggers re-probe if mode is auto/external.
 */
router.put('/integration/:integrationId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { integrationId } = req.params;
        const { mode, retentionDays } = req.body;

        // Validate mode
        const validModes = ['auto', 'internal', 'external', 'off'];
        if (mode && !validModes.includes(mode)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAM',
                    message: `Invalid mode: ${mode}. Valid values: ${validModes.join(', ')}`
                }
            });
            return;
        }

        // Validate retentionDays
        if (retentionDays !== undefined && (typeof retentionDays !== 'number' || retentionDays < 1 || retentionDays > 30)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAM',
                    message: 'retentionDays must be a number between 1 and 30'
                }
            });
            return;
        }

        // Build config update (merge with existing)
        const currentConfig = metricHistoryService.getIntegrationConfig(integrationId);
        const newConfig = {
            mode: mode ?? currentConfig.mode,
            retentionDays: retentionDays ?? currentConfig.retentionDays,
        };

        await metricHistoryService.updateIntegrationConfig(integrationId, newConfig);

        // Re-probe if switching to auto/external mode
        if (mode && (mode === 'auto' || mode === 'external')) {
            await metricHistoryService.onIntegrationSaved(integrationId);
        }

        res.json({
            success: true,
            integrationId,
            config: newConfig,
        });

        // Broadcast so widgets and other forms update in real-time
        invalidateSystemSettings('metric-history');
    } catch (error) {
        logger.error(`[MetricHistory] Update integration config failed: ${(error as Error).message}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'CONFIG_ERROR',
                message: 'Failed to update integration metric history config'
            }
        });
    }
});

// ============================================================================
// QUERY ENDPOINT (catch-all — MUST be LAST)
// ============================================================================

/**
 * GET /api/metric-history/:integrationId
 * Get metric history for a specific integration.
 *
 * Query params:
 *   - metric: string (required) — e.g. 'cpu', 'memory', 'temperature'
 *   - range: string (optional) — e.g. '5m', '15m', '1h', '3h', '1d', '7d'. Default: '1h'
 *
 * WARNING: This route uses a parameterized path and MUST be the last GET route
 * to avoid shadowing static paths like /status, /availability, /integration.
 */
router.get('/:integrationId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        if (!metricHistoryService.isEnabled()) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'FEATURE_DISABLED',
                    message: 'Metric history recording is not enabled'
                }
            });
            return;
        }

        const { integrationId } = req.params;
        const metric = req.query.metric as string;
        const range = (req.query.range as string) || '1h';

        if (!metric) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_PARAM',
                    message: 'Missing required query parameter: metric'
                }
            });
            return;
        }

        // Validate metric key against plugin declarations
        const instance = integrationInstancesDb.getInstanceById(integrationId);
        if (!instance) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `Integration not found: ${integrationId}`
                }
            });
            return;
        }

        const plugin = getPlugin(instance.type);
        const recordableKeys = plugin?.metrics?.filter(m => m.recordable).map(m => m.key) ?? [];

        if (!recordableKeys.includes(metric)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAM',
                    message: `Invalid metric: ${metric}. Valid values: ${recordableKeys.join(', ')}`
                }
            });
            return;
        }

        const data = await metricHistoryService.getHistory(integrationId, metric, range);

        res.json({
            success: true,
            ...data,
        });
    } catch (error) {
        logger.error(`[MetricHistory] Query failed: ${(error as Error).message}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'QUERY_ERROR',
                message: 'Failed to query metric history'
            }
        });
    }
});

export default router;
