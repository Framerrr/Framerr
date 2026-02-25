/**
 * Library Image Cache Service
 * 
 * Downloads and caches media thumbnails from Plex, Jellyfin, and Emby.
 * Images are organized by integration instance ID for easy cleanup.
 * 
 * Storage: {DATA_DIR}/cache/library/{integrationId}/{itemKey}.jpg
 * 
 * RATE LIMITING:
 * Uses a semaphore to limit concurrent downloads to prevent network saturation.
 * This ensures bulk syncs (1000+ items) don't overwhelm the connection.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios'; // Kept for cacheLibraryImage (Tier 2 — receives pre-built URLs)
import logger from '../utils/logger';
import { Semaphore } from '../utils/semaphore';
import { BaseAdapter } from '../integrations/BaseAdapter';
import { PluginInstance } from '../integrations/types';

// Use DATA_DIR from environment or default to server/data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

// Library cache directory (separate from TMDB cache)
const LIBRARY_CACHE_DIR = path.join(DATA_DIR, 'cache', 'library');

// Rate limiting: max 5 concurrent image downloads to prevent network saturation
const IMAGE_DOWNLOAD_CONCURRENCY = 5;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 10000; // 10s timeout (reduced from 15s)
const imageSemaphore = new Semaphore(IMAGE_DOWNLOAD_CONCURRENCY);

/**
 * Ensure cache directory exists for an integration
 */
function ensureCacheDir(integrationId: string): string {
    const dir = path.join(LIBRARY_CACHE_DIR, integrationId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`[LibraryImageCache] Created cache directory for integration: integrationId=${integrationId}`);
    }
    return dir;
}

/**
 * Sanitize item key for use as filename
 * Removes/replaces characters that are invalid in filenames
 */
function sanitizeItemKey(itemKey: string): string {
    return itemKey.replace(/[<>:"/\\|?*]/g, '_');
}

/**
 * Get local filename for cached library image
 */
export function getLibraryImageFilename(itemKey: string): string {
    return `${sanitizeItemKey(itemKey)}.jpg`;
}

/**
 * Get full local path for cached library image
 */
export function getLibraryImagePath(integrationId: string, itemKey: string): string {
    return path.join(LIBRARY_CACHE_DIR, integrationId, getLibraryImageFilename(itemKey));
}

/**
 * Check if library image is already cached
 */
export function isLibraryImageCached(integrationId: string, itemKey: string): boolean {
    return fs.existsSync(getLibraryImagePath(integrationId, itemKey));
}

/**
 * Download and cache an image from a media server
 * 
 * Rate-limited: Max 5 concurrent downloads to prevent network saturation.
 * 
 * @param integrationId - Integration instance ID
 * @param itemKey - Item key from media server (e.g., Plex ratingKey)
 * @param imageUrl - Full URL to the image (with auth if needed)
 * @param authHeaders - Optional auth headers (for Plex X-Plex-Token, etc.)
 * @returns Local filename if successful, null otherwise
 */
export async function cacheLibraryImage(
    integrationId: string,
    itemKey: string,
    imageUrl: string,
    authHeaders?: Record<string, string>
): Promise<string | null> {
    if (!imageUrl) return null;

    // Acquire semaphore permit (wait if at capacity)
    await imageSemaphore.acquire();

    try {
        ensureCacheDir(integrationId);

        const localPath = getLibraryImagePath(integrationId, itemKey);
        const filename = getLibraryImageFilename(itemKey);

        // Check if already cached
        if (fs.existsSync(localPath)) {
            return filename;
        }

        // Download image with auth headers if provided
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: IMAGE_DOWNLOAD_TIMEOUT_MS,
            headers: authHeaders || {}
        });

        // Save to disk
        fs.writeFileSync(localPath, response.data);
        logger.debug(`[LibraryImageCache] Cached image: integrationId=${integrationId}, itemKey=${itemKey}`);

        return filename;
    } catch (error) {
        const axiosError = error as { response?: { status?: number }; message?: string };
        const errorMsg = axiosError.response?.status
            ? `HTTP ${axiosError.response.status}`
            : axiosError.message || 'Unknown error';
        logger.warn(`[LibraryImageCache] Failed to cache image: integrationId=${integrationId}, itemKey=${itemKey}, error="${errorMsg}"`);
        return null;
    } finally {
        // Always release the permit
        imageSemaphore.release();
    }
}

/**
 * Get the local URL for serving a cached library image
 * Returns null if not cached
 */
export function getLocalLibraryImageUrl(integrationId: string, itemKey: string): string | null {
    if (isLibraryImageCached(integrationId, itemKey)) {
        return `/api/cache/library/${integrationId}/${getLibraryImageFilename(itemKey)}`;
    }
    return null;
}

/**
 * Delete a single cached library image
 */
export function deleteLibraryImage(integrationId: string, itemKey: string): void {
    const imagePath = getLibraryImagePath(integrationId, itemKey);
    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        logger.debug(`[LibraryImageCache] Deleted image: integrationId=${integrationId}, itemKey=${itemKey}`);
    }
}

/**
 * Delete all cached images for an integration
 * Called when integration is deleted or sync is disabled
 */
export function deleteAllLibraryImages(integrationId: string): { deleted: number; freed: number } {
    const dir = path.join(LIBRARY_CACHE_DIR, integrationId);
    let deleted = 0;
    let freedBytes = 0;

    if (!fs.existsSync(dir)) {
        return { deleted: 0, freed: 0 };
    }

    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            freedBytes += stats.size;
            fs.unlinkSync(filePath);
            deleted++;
        }

        // Remove the directory itself
        fs.rmdirSync(dir);
        logger.info(`[LibraryImageCache] Purged cache for integration: integrationId=${integrationId}, deleted=${deleted}, freedKB=${Math.round(freedBytes / 1024)}`);
    } catch (error) {
        logger.error(`[LibraryImageCache] Purge error: integrationId=${integrationId}, error="${(error as Error).message}"`);
    }

    return { deleted, freed: freedBytes };
}

/**
 * Cleanup old library images not accessed in the given number of days
 * Operates across all integrations
 */
export function cleanupOldLibraryImages(maxAgeDays: number = 30): { deleted: number; freed: number } {
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    let deleted = 0;
    let freedBytes = 0;

    if (!fs.existsSync(LIBRARY_CACHE_DIR)) {
        return { deleted: 0, freed: 0 };
    }

    try {
        // Iterate through integration directories
        const integrationDirs = fs.readdirSync(LIBRARY_CACHE_DIR);

        for (const integrationId of integrationDirs) {
            const integrationDir = path.join(LIBRARY_CACHE_DIR, integrationId);
            const stats = fs.statSync(integrationDir);

            if (!stats.isDirectory()) continue;

            const files = fs.readdirSync(integrationDir);

            for (const file of files) {
                const filePath = path.join(integrationDir, file);
                const fileStats = fs.statSync(filePath);
                const lastAccess = fileStats.atimeMs || fileStats.mtimeMs;

                if (now - lastAccess > maxAgeMs) {
                    freedBytes += fileStats.size;
                    fs.unlinkSync(filePath);
                    deleted++;
                }
            }

            // Remove empty directories
            const remainingFiles = fs.readdirSync(integrationDir);
            if (remainingFiles.length === 0) {
                fs.rmdirSync(integrationDir);
            }
        }

        if (deleted > 0) {
            logger.info(`[LibraryImageCache] Cleanup: deleted=${deleted}, freedKB=${Math.round(freedBytes / 1024)}`);
        }
    } catch (error) {
        logger.error(`[LibraryImageCache] Cleanup error: error="${(error as Error).message}"`);
    }

    return { deleted, freed: freedBytes };
}

/**
 * Get cache stats for library images
 */
export function getLibraryCacheStats(): { integrations: number; totalImages: number; sizeBytes: number } {
    let integrations = 0;
    let totalImages = 0;
    let sizeBytes = 0;

    if (!fs.existsSync(LIBRARY_CACHE_DIR)) {
        return { integrations: 0, totalImages: 0, sizeBytes: 0 };
    }

    try {
        const integrationDirs = fs.readdirSync(LIBRARY_CACHE_DIR);
        integrations = integrationDirs.length;

        for (const integrationId of integrationDirs) {
            const integrationDir = path.join(LIBRARY_CACHE_DIR, integrationId);
            const stats = fs.statSync(integrationDir);

            if (!stats.isDirectory()) continue;

            const files = fs.readdirSync(integrationDir);
            totalImages += files.length;

            for (const file of files) {
                const fileStats = fs.statSync(path.join(integrationDir, file));
                sizeBytes += fileStats.size;
            }
        }
    } catch {
        // Ignore errors
    }

    return { integrations, totalImages, sizeBytes };
}

/**
 * Get per-integration library cache stats (for Jobs & Cache UI breakdown)
 */
export function getPerIntegrationLibraryStats(): Array<{ integrationId: string; imageCount: number; sizeBytes: number }> {
    const result: Array<{ integrationId: string; imageCount: number; sizeBytes: number }> = [];

    if (!fs.existsSync(LIBRARY_CACHE_DIR)) {
        return result;
    }

    try {
        const integrationDirs = fs.readdirSync(LIBRARY_CACHE_DIR);

        for (const integrationId of integrationDirs) {
            const integrationDir = path.join(LIBRARY_CACHE_DIR, integrationId);
            const stats = fs.statSync(integrationDir);

            if (!stats.isDirectory()) continue;

            const files = fs.readdirSync(integrationDir);
            let sizeBytes = 0;

            for (const file of files) {
                const fileStats = fs.statSync(path.join(integrationDir, file));
                sizeBytes += fileStats.size;
            }

            result.push({
                integrationId,
                imageCount: files.length,
                sizeBytes
            });
        }
    } catch {
        // Ignore errors
    }

    return result;
}

// ============================================================================
// LARGE IMAGE LRU CACHE (for modal view)
// ============================================================================

const LARGE_IMAGE_SIZE = { width: 480, height: 720 };
const MAX_LARGE_IMAGES = 100;

/**
 * Get filename for large cached image
 */
export function getLargeImageFilename(itemKey: string): string {
    return `${sanitizeItemKey(itemKey)}_lg.jpg`;
}

/**
 * Get path for large cached image
 */
export function getLargeImagePath(integrationId: string, itemKey: string): string {
    return path.join(LIBRARY_CACHE_DIR, integrationId, getLargeImageFilename(itemKey));
}

/**
 * Check if large image is cached
 */
export function isLargeImageCached(integrationId: string, itemKey: string): boolean {
    return fs.existsSync(getLargeImagePath(integrationId, itemKey));
}

/**
 * Get or fetch large image from Plex transcode endpoint
 * Uses LRU eviction when cache exceeds MAX_LARGE_IMAGES
 * 
 * @param adapter - Plex adapter instance
 * @param instance - Plugin instance with Plex config
 * @param integrationId - Integration instance ID
 * @param itemKey - Media item key (ratingKey)
 * @param originalThumbPath - Original thumb path (e.g., /library/metadata/123/thumb/456)
 * @returns Local file path if successful, null otherwise
 */
export async function getOrFetchLargeImage(
    adapter: BaseAdapter,
    instance: PluginInstance,
    integrationId: string,
    itemKey: string,
    originalThumbPath: string
): Promise<string | null> {
    ensureCacheDir(integrationId);
    const localPath = getLargeImagePath(integrationId, itemKey);

    // If cached, update access time and return
    if (fs.existsSync(localPath)) {
        // Touch the file to update atime for LRU
        const now = new Date();
        try {
            fs.utimesSync(localPath, now, now);
        } catch {
            // Ignore access time update errors
        }
        return localPath;
    }

    // Fetch from Plex transcode
    try {
        // Pass raw thumb path — axios auto-encodes params, so manual
        // encodeURIComponent would cause double-encoding (%2F → %252F)
        const response = await adapter.get(instance, '/photo/:/transcode', {
            params: {
                width: LARGE_IMAGE_SIZE.width,
                height: LARGE_IMAGE_SIZE.height,
                minSize: 1,
                upscale: 1,
                url: originalThumbPath,
            },
            responseType: 'arraybuffer',
            timeout: 15000
        });

        // Save to disk
        fs.writeFileSync(localPath, response.data);
        logger.debug(`[LibraryImageCache] Cached large image: integrationId=${integrationId}, itemKey=${itemKey}`);

        // Enforce LRU limit
        enforceLargeImageLimit(integrationId);

        return localPath;
    } catch (error) {
        logger.warn(`[LibraryImageCache] Failed to fetch large image: integrationId=${integrationId}, itemKey=${itemKey}, error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Get or fetch large image from Jellyfin/Emby server
 * Uses native image resize endpoint. Same LRU eviction as Plex variant.
 * 
 * @param adapter - Jellyfin or Emby adapter instance
 * @param instance - Plugin instance with server config
 * @param integrationId - Integration instance ID
 * @param itemKey - Media item ID
 * @returns Local file path if successful, null otherwise
 */
export async function getOrFetchLargeImageJellyfinEmby(
    adapter: BaseAdapter,
    instance: PluginInstance,
    integrationId: string,
    itemKey: string
): Promise<string | null> {
    ensureCacheDir(integrationId);
    const localPath = getLargeImagePath(integrationId, itemKey);

    // If cached, update access time and return
    if (fs.existsSync(localPath)) {
        const now = new Date();
        try { fs.utimesSync(localPath, now, now); } catch { /* ignore */ }
        return localPath;
    }

    // Fetch from Jellyfin/Emby native image endpoint
    try {
        const response = await adapter.get(instance, `/Items/${itemKey}/Images/Primary`, {
            params: {
                fillWidth: LARGE_IMAGE_SIZE.width,
                fillHeight: LARGE_IMAGE_SIZE.height,
            },
            responseType: 'arraybuffer',
            timeout: 15000,
        });

        // Save to disk
        fs.writeFileSync(localPath, response.data);
        logger.debug(`[LibraryImageCache] Cached large image (${instance.type}): integrationId=${integrationId}, itemKey=${itemKey}`);

        // Enforce LRU limit
        enforceLargeImageLimit(integrationId);

        return localPath;
    } catch (error) {
        logger.warn(`[LibraryImageCache] Failed to fetch large image (${instance.type}): integrationId=${integrationId}, itemKey=${itemKey}, error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Enforce LRU limit on large images for an integration
 * Deletes oldest accessed files when count exceeds MAX_LARGE_IMAGES
 */
function enforceLargeImageLimit(integrationId: string): void {
    const dir = path.join(LIBRARY_CACHE_DIR, integrationId);
    if (!fs.existsSync(dir)) return;

    try {
        const files = fs.readdirSync(dir);
        const largeFiles: { name: string; atime: number }[] = [];

        // Collect large image files with access times
        for (const file of files) {
            if (file.endsWith('_lg.jpg')) {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                largeFiles.push({
                    name: file,
                    atime: stats.atimeMs || stats.mtimeMs
                });
            }
        }

        // If over limit, delete oldest
        if (largeFiles.length > MAX_LARGE_IMAGES) {
            // Sort by access time (oldest first)
            largeFiles.sort((a, b) => a.atime - b.atime);

            const toDelete = largeFiles.length - MAX_LARGE_IMAGES;
            for (let i = 0; i < toDelete; i++) {
                const filePath = path.join(dir, largeFiles[i].name);
                fs.unlinkSync(filePath);
                logger.debug(`[LibraryImageCache] LRU evicted: integrationId=${integrationId}, file=${largeFiles[i].name}`);
            }
        }
    } catch (error) {
        logger.warn(`[LibraryImageCache] LRU enforcement error: integrationId=${integrationId}, error="${(error as Error).message}"`);
    }
}
