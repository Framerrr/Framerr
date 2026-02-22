/**
 * Jobs & Cache Routes
 * 
 * API endpoints for managing background jobs and cache data.
 * Used by the Settings > Advanced > Jobs & Cache page.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/auth';
import { getJobStatuses, triggerJob, triggerJobAsync } from '../services/jobScheduler';
import { getCacheStats as getTmdbCacheStats, flushAllCache as flushTmdbCache } from '../db/mediaCache';
import { getCacheStats as getImageCacheStats, deleteAllCachedImages } from '../services/imageCache';
import { clearAllSearchHistory, getSearchHistoryCount } from '../db/mediaSearchHistory';
import { getLibraryCacheStats, getPerIntegrationLibraryStats, deleteAllLibraryImages } from '../services/libraryImageCache';
import { deleteLibrarySyncData, startFullSync, getSyncStatus, getMediaServerIntegrationsWithSync } from '../services/librarySyncService';
import { getMonitorDefaults, getMetricHistoryDefaults, updateSystemConfig } from '../db/systemConfig';
import { getInstanceById } from '../db/integrationInstances';
import * as metricHistoryDb from '../db/metricHistory';
import { metricHistoryService } from '../services/MetricHistoryService';
import logger from '../utils/logger';

const router = Router();

// ============================================================================
// Jobs Endpoints
// ============================================================================

/**
 * GET /api/jobs
 * 
 * Get status of all registered background jobs.
 */
router.get('/', requireAuth, requireAdmin, (_req: Request, res: Response): void => {
    try {
        const jobs = getJobStatuses();
        res.json({ jobs });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to get jobs: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get job statuses' });
    }
});

/**
 * POST /api/jobs/:id/run
 * 
 * Manually trigger a job to run now.
 * For library-sync: uses async trigger and returns library count immediately.
 * For other jobs: runs synchronously and returns when complete.
 */
router.post('/:id/run', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        // Library sync: trigger async and return count immediately
        if (id === 'library-sync') {
            const mediaServers = getMediaServerIntegrationsWithSync();
            const libraryCount = mediaServers.length;

            if (libraryCount === 0) {
                res.json({ success: true, message: 'No libraries with sync enabled', libraryCount: 0 });
                return;
            }

            const started = triggerJobAsync(id);
            if (started) {
                res.json({ success: true, message: `Library sync started`, libraryCount });
            } else {
                res.status(400).json({ error: 'Library sync is already running' });
            }
            return;
        }

        // All other jobs: run synchronously
        const success = await triggerJob(id);

        if (success) {
            res.json({ success: true, message: `Job ${id} triggered successfully` });
        } else {
            res.status(400).json({ error: `Job ${id} not found or already running` });
        }
    } catch (error) {
        logger.error(`[JobsAPI] Failed to trigger job: id=${req.params.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to trigger job' });
    }
});

// ============================================================================
// Cache Stats & Flush Endpoints
// ============================================================================

/**
 * GET /api/jobs/cache/stats
 * 
 * Get cache statistics for all cache types.
 */
router.get('/cache/stats', requireAuth, requireAdmin, (_req: Request, res: Response): void => {
    try {
        const tmdbMetadata = getTmdbCacheStats();
        const tmdbImages = getImageCacheStats();
        const searchHistory = { count: getSearchHistoryCount() };
        const library = getLibraryCacheStats();
        const rawStats = getPerIntegrationLibraryStats();

        // Enrich with display names from integration instances
        const libraryPerIntegration = rawStats.map(stat => {
            const instance = getInstanceById(stat.integrationId);
            const fallbackName = instance?.type
                ? instance.type.charAt(0).toUpperCase() + instance.type.slice(1)
                : stat.integrationId;
            return {
                ...stat,
                displayName: instance?.displayName || fallbackName,
            };
        });

        // Metric history stats (with display names)
        const mhStats = metricHistoryDb.getStorageStats();
        const metricHistory = {
            totalDataPoints: mhStats.totalRows,
            integrations: mhStats.integrations.map(i => {
                const instance = getInstanceById(i.integrationId);
                const fallbackName = instance?.type
                    ? instance.type.charAt(0).toUpperCase() + instance.type.slice(1)
                    : i.integrationId;
                return {
                    integrationId: i.integrationId,
                    displayName: instance?.displayName || fallbackName,
                    dataPoints: i.rowCount,
                };
            }),
        };

        res.json({
            tmdbMetadata,
            tmdbImages,
            searchHistory,
            library,
            libraryPerIntegration,
            metricHistory,
        });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to get cache stats: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get cache statistics' });
    }
});

/**
 * POST /api/jobs/cache/tmdb-metadata/flush
 * 
 * Flush all TMDB metadata cache entries.
 */
router.post('/cache/tmdb-metadata/flush', requireAuth, requireAdmin, (_req: Request, res: Response): void => {
    try {
        const deleted = flushTmdbCache();
        logger.info(`[JobsAPI] Flushed TMDB metadata cache: deleted=${deleted}`);
        res.json({ success: true, deleted });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to flush TMDB metadata: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to flush TMDB metadata cache' });
    }
});

/**
 * POST /api/jobs/cache/tmdb-images/flush
 * 
 * Flush all cached TMDB poster/backdrop images.
 */
router.post('/cache/tmdb-images/flush', requireAuth, requireAdmin, (_req: Request, res: Response): void => {
    try {
        const result = deleteAllCachedImages();
        logger.info(`[JobsAPI] Flushed TMDB image cache: deleted=${result.deleted} freedKB=${Math.round(result.freed / 1024)}`);
        res.json({ success: true, deleted: result.deleted, freed: result.freed });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to flush TMDB images: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to flush TMDB image cache' });
    }
});

/**
 * POST /api/jobs/cache/search-history/clear
 * 
 * Clear all search history across all widgets.
 */
router.post('/cache/search-history/clear', requireAuth, requireAdmin, (_req: Request, res: Response): void => {
    try {
        const deleted = clearAllSearchHistory();
        logger.info(`[JobsAPI] Cleared all search history: deleted=${deleted}`);
        res.json({ success: true, deleted });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to clear search history: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to clear search history' });
    }
});

/**
 * POST /api/jobs/cache/library/flush
 *
 * Flush all library cache data across all integrations.
 */
router.post('/cache/library/flush', requireAuth, requireAdmin, (_req: Request, res: Response): void => {
    try {
        const stats = getPerIntegrationLibraryStats();
        let totalDeleted = 0;
        for (const stat of stats) {
            deleteLibrarySyncData(stat.integrationId);
            totalDeleted++;
        }
        logger.info(`[JobsAPI] Flushed all library cache: ${totalDeleted} integrations`);
        res.json({ success: true, deleted: totalDeleted });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to flush all library cache: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to flush all library cache' });
    }
});

/**
 * POST /api/jobs/cache/library/:integrationId/flush
 * 
 * Full purge of library cache for a specific integration.
 * Deletes: cached images, media_library DB entries, sync status, FTS entries.
 */
router.post('/cache/library/:integrationId/flush', requireAuth, requireAdmin, (req: Request, res: Response): void => {
    try {
        const { integrationId } = req.params;
        deleteLibrarySyncData(integrationId);
        logger.info(`[JobsAPI] Flushed library cache for integration: integrationId=${integrationId}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to flush library cache: integrationId=${req.params.integrationId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to flush library cache' });
    }
});

/**
 * POST /api/jobs/cache/library/:integrationId/sync
 * 
 * Trigger a library re-sync for a specific integration.
 */
router.post('/cache/library/:integrationId/sync', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { integrationId } = req.params;
        const result = await startFullSync(integrationId);

        if (result.success) {
            res.json({ success: true, message: 'Sync started' });
        } else {
            res.status(400).json({ error: result.error || 'Failed to start sync' });
        }
    } catch (error) {
        logger.error(`[JobsAPI] Failed to trigger library sync: integrationId=${req.params.integrationId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to trigger library sync' });
    }
});

/**
 * GET /api/jobs/cache/library/:integrationId/status
 * 
 * Get sync status for a specific integration.
 */
router.get('/cache/library/:integrationId/status', requireAuth, requireAdmin, (req: Request, res: Response): void => {
    try {
        const { integrationId } = req.params;
        const status = getSyncStatus(integrationId);
        res.json({ status });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to get sync status: integrationId=${req.params.integrationId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get sync status' });
    }
});

// ============================================================================
// Metric History Flush Endpoints
// ============================================================================

/**
 * POST /api/jobs/cache/metric-history/flush
 *
 * Flush all metric history data.
 */
router.post('/cache/metric-history/flush', requireAuth, requireAdmin, (_req: Request, res: Response): void => {
    try {
        const deleted = metricHistoryDb.deleteAll();
        logger.info(`[JobsAPI] Flushed all metric history: deleted=${deleted}`);
        res.json({ success: true, deleted });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to flush metric history: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to flush metric history' });
    }
});

/**
 * POST /api/jobs/cache/metric-history/:integrationId/flush
 *
 * Flush metric history for a specific integration.
 */
router.post('/cache/metric-history/:integrationId/flush', requireAuth, requireAdmin, (req: Request, res: Response): void => {
    try {
        const { integrationId } = req.params;
        const deleted = metricHistoryDb.deleteForIntegration(integrationId);
        logger.info(`[JobsAPI] Flushed metric history for integration: integrationId=${integrationId} deleted=${deleted}`);
        res.json({ success: true, deleted });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to flush metric history: integrationId=${req.params.integrationId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to flush metric history for integration' });
    }
});

// ============================================================================
// Defaults Endpoints (Monitor + Metric History)
// ============================================================================

/**
 * GET /api/jobs/defaults
 *
 * Get all global defaults (monitor + metric history).
 */
router.get('/defaults', requireAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
        const monitorDefaults = await getMonitorDefaults();
        const metricHistoryDefaults = await getMetricHistoryDefaults();
        res.json({ monitorDefaults, metricHistoryDefaults });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to get defaults: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get defaults' });
    }
});

/**
 * PUT /api/jobs/defaults
 *
 * Update global defaults (monitor + metric history).
 * Accepts { monitorDefaults?: {...}, metricHistoryDefaults?: {...} }
 */
router.put('/defaults', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { monitorDefaults, metricHistoryDefaults } = req.body;
        const updates: Record<string, unknown> = {};

        if (monitorDefaults) {
            const md: Record<string, unknown> = {};
            if (monitorDefaults.intervalSeconds !== undefined) md.intervalSeconds = Number(monitorDefaults.intervalSeconds);
            if (monitorDefaults.timeoutSeconds !== undefined) md.timeoutSeconds = Number(monitorDefaults.timeoutSeconds);
            if (monitorDefaults.retriesBeforeDown !== undefined) md.retriesBeforeDown = Number(monitorDefaults.retriesBeforeDown);
            if (monitorDefaults.degradedThresholdMs !== undefined) md.degradedThresholdMs = Number(monitorDefaults.degradedThresholdMs);
            if (monitorDefaults.expectedStatusCodes !== undefined) md.expectedStatusCodes = monitorDefaults.expectedStatusCodes;
            updates.monitorDefaults = md;
        }

        if (metricHistoryDefaults) {
            const mhd: Record<string, unknown> = {};
            if (metricHistoryDefaults.mode !== undefined) mhd.mode = metricHistoryDefaults.mode;
            if (metricHistoryDefaults.retentionDays !== undefined) mhd.retentionDays = Number(metricHistoryDefaults.retentionDays);
            updates.metricHistoryDefaults = mhd;
        }

        await updateSystemConfig(updates as any);

        const newMonitorDefaults = await getMonitorDefaults();
        const newMetricHistoryDefaults = await getMetricHistoryDefaults();

        // Refresh the cached global defaults in MetricHistoryService
        await metricHistoryService.refreshGlobalDefaults();

        logger.info('[JobsAPI] Updated defaults');
        res.json({ monitorDefaults: newMonitorDefaults, metricHistoryDefaults: newMetricHistoryDefaults });
    } catch (error) {
        logger.error(`[JobsAPI] Failed to update defaults: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update defaults' });
    }
});

/**
 * GET /api/jobs/monitor-defaults (backward compat)
 */
router.get('/monitor-defaults', requireAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
        const defaults = await getMonitorDefaults();
        res.json(defaults);
    } catch (error) {
        logger.error(`[JobsAPI] Failed to get monitor defaults: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get monitor defaults' });
    }
});

export default router;
