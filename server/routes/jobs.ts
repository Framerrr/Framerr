/**
 * Jobs & Cache Routes
 * 
 * API endpoints for managing background jobs and cache data.
 * Used by the Settings > Advanced > Jobs & Cache page.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/auth';
import { getJobStatuses, triggerJob } from '../services/jobScheduler';
import { getCacheStats as getTmdbCacheStats, flushAllCache as flushTmdbCache } from '../db/mediaCache';
import { getCacheStats as getImageCacheStats, deleteAllCachedImages } from '../services/imageCache';
import { clearAllSearchHistory, getSearchHistoryCount } from '../db/mediaSearchHistory';
import { getLibraryCacheStats, getPerIntegrationLibraryStats, deleteAllLibraryImages } from '../services/libraryImageCache';
import { deleteLibrarySyncData, startFullSync, getSyncStatus } from '../services/librarySyncService';
import { getMonitorDefaults, updateSystemConfig } from '../db/systemConfig';
import { getInstanceById } from '../db/integrationInstances';
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
 */
router.post('/:id/run', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
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
            return {
                ...stat,
                displayName: instance?.displayName || stat.integrationId,
            };
        });

        res.json({
            tmdbMetadata,
            tmdbImages,
            searchHistory,
            library,
            libraryPerIntegration,
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
// Monitor Defaults Endpoints
// ============================================================================

/**
 * GET /api/jobs/monitor-defaults
 * 
 * Get global monitor defaults.
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

/**
 * PUT /api/jobs/monitor-defaults
 * 
 * Update global monitor defaults.
 */
router.put('/monitor-defaults', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { intervalSeconds, timeoutSeconds, retriesBeforeDown, degradedThresholdMs, expectedStatusCodes } = req.body;

        // Build partial update — only include provided fields
        const updates: Record<string, unknown> = {};
        if (intervalSeconds !== undefined) updates.intervalSeconds = Number(intervalSeconds);
        if (timeoutSeconds !== undefined) updates.timeoutSeconds = Number(timeoutSeconds);
        if (retriesBeforeDown !== undefined) updates.retriesBeforeDown = Number(retriesBeforeDown);
        if (degradedThresholdMs !== undefined) updates.degradedThresholdMs = Number(degradedThresholdMs);
        if (expectedStatusCodes !== undefined) updates.expectedStatusCodes = expectedStatusCodes;

        await updateSystemConfig({ monitorDefaults: updates as any });
        const newDefaults = await getMonitorDefaults();

        logger.info('[JobsAPI] Updated monitor defaults');
        res.json(newDefaults);
    } catch (error) {
        logger.error(`[JobsAPI] Failed to update monitor defaults: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update monitor defaults' });
    }
});

export default router;

