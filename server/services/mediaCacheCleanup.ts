/**
 * Media Cache Cleanup Job
 * 
 * Cleans up stale cache entries on a cron schedule (3am daily).
 * - Cleans database entries not accessed in 30 days
 * - Cleans image files not accessed in 30 days
 * 
 * Uses jobScheduler for wall-clock reliable scheduling.
 */

import logger from '../utils/logger';
import { yieldToEventLoop } from '../utils/eventLoopYield';
import { cleanupStaleEntries as cleanupDbEntries, getCacheStats } from '../db/mediaCache';
import { cleanupOldImages, getCacheStats as getImageStats } from './imageCache';
import { registerJob, unregisterJob } from './jobScheduler';

/** Max age for stale entries: 30 days */
const MAX_AGE_DAYS = 30;

/** Job ID for scheduler registration */
const JOB_ID = 'media-cache-cleanup';

/**
 * Run cleanup with event-loop yields between heavy sync operations.
 */
async function runCleanup(): Promise<void> {
    logger.debug('[MediaCacheCleanup] Starting cleanup job');

    // Yield before sync DB cleanup
    await yieldToEventLoop();
    const dbDeleted = cleanupDbEntries(MAX_AGE_DAYS);

    // Yield before sync FS cleanup
    await yieldToEventLoop();
    const { deleted: imagesDeleted, freed } = cleanupOldImages(MAX_AGE_DAYS);

    // Yield before sync stats reads
    await yieldToEventLoop();
    const dbStats = getCacheStats();
    const imageStats = getImageStats();

    logger.debug(`[MediaCacheCleanup] Complete: dbDeleted=${dbDeleted} imagesDeleted=${imagesDeleted} freedMB=${Math.round(freed / 1024 / 1024 * 100) / 100} dbEntries=${dbStats.count} images=${imageStats.count} sizeMB=${Math.round(imageStats.sizeBytes / 1024 / 1024 * 100) / 100}`);
}

/**
 * Start the cleanup job via cron scheduler
 */
export function startCleanupJob(): void {
    registerJob({
        id: JOB_ID,
        name: 'Media Cache Cleanup',
        cronExpression: '0 3 * * *', // 3:00 AM daily
        description: 'Daily at 3:00 AM',
        execute: async () => runCleanup(),
        runOnStart: true,
    });
}

/**
 * Stop the cleanup job
 */
export function stopCleanupJob(): void {
    unregisterJob(JOB_ID);
}

/**
 * Manually trigger cleanup
 */
export async function triggerCleanup(): Promise<void> {
    await runCleanup();
}
