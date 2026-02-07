/**
 * Image Cache Service
 * 
 * Downloads and caches TMDB poster/backdrop images locally.
 * Images are stored in {DATA_DIR}/cache/images/
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import logger from '../utils/logger';

// Use DATA_DIR from environment or default to server/data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

// Cache directory
const CACHE_DIR = path.join(DATA_DIR, 'cache', 'images');

// TMDB image base URL
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// Image sizes
const POSTER_SIZE = 'w342';  // ~30-50KB, good for widgets
const BACKDROP_SIZE = 'w780'; // ~80-150KB, optional

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        logger.info(`[ImageCache] Created cache directory: path=${CACHE_DIR}`);
    }
}

/**
 * Get local filename for cached image
 */
export function getImageFilename(tmdbId: number, type: 'poster' | 'backdrop'): string {
    return `tmdb_${tmdbId}_${type}.jpg`;
}

/**
 * Get full local path for cached image
 */
export function getImagePath(tmdbId: number, type: 'poster' | 'backdrop'): string {
    return path.join(CACHE_DIR, getImageFilename(tmdbId, type));
}

/**
 * Check if image is already cached
 */
export function isImageCached(tmdbId: number, type: 'poster' | 'backdrop'): boolean {
    return fs.existsSync(getImagePath(tmdbId, type));
}

/**
 * Download and cache an image from TMDB
 * 
 * @param tmdbId - TMDB ID of the media
 * @param tmdbPath - Poster path from TMDB (e.g., "/abc123.jpg")
 * @param type - 'poster' or 'backdrop'
 * @returns Local filename if successful, null otherwise
 */
export async function cacheImage(
    tmdbId: number,
    tmdbPath: string,
    type: 'poster' | 'backdrop' = 'poster'
): Promise<string | null> {
    if (!tmdbPath) return null;

    try {
        ensureCacheDir();

        const size = type === 'poster' ? POSTER_SIZE : BACKDROP_SIZE;
        const url = `${TMDB_IMAGE_BASE}/${size}${tmdbPath}`;
        const localPath = getImagePath(tmdbId, type);
        const filename = getImageFilename(tmdbId, type);

        // Download image
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000
        });

        // Save to disk
        fs.writeFileSync(localPath, response.data);
        logger.debug(`[ImageCache] Cached ${type} for tmdb_${tmdbId}`);

        return filename;
    } catch (error) {
        // Get detailed error message for axios errors
        const axiosError = error as { response?: { status?: number }; message?: string };
        const errorMsg = axiosError.response?.status
            ? `HTTP ${axiosError.response.status}`
            : axiosError.message || 'Unknown error';
        logger.warn(`[ImageCache] Failed to cache ${type} for tmdb_${tmdbId}: error="${errorMsg}"`);
        return null;
    }
}

/**
 * Get the local URL for serving a cached image
 * Returns null if not cached
 */
export function getLocalImageUrl(tmdbId: number, type: 'poster' | 'backdrop'): string | null {
    if (isImageCached(tmdbId, type)) {
        return `/api/cache/images/${getImageFilename(tmdbId, type)}`;
    }
    return null;
}

/**
 * Delete a cached image
 */
export function deleteImage(tmdbId: number, type: 'poster' | 'backdrop'): void {
    const imagePath = getImagePath(tmdbId, type);
    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        logger.debug(`[ImageCache] Deleted ${type} for tmdb_${tmdbId}`);
    }
}

/**
 * Cleanup old images not accessed in the given number of days
 * Called by the cleanup job
 */
export function cleanupOldImages(maxAgeDays: number = 30): { deleted: number; freed: number } {
    ensureCacheDir();

    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    let deleted = 0;
    let freedBytes = 0;

    try {
        const files = fs.readdirSync(CACHE_DIR);

        for (const file of files) {
            const filePath = path.join(CACHE_DIR, file);
            const stats = fs.statSync(filePath);

            // Use atime (access time) if available, otherwise mtime
            const lastAccess = stats.atimeMs || stats.mtimeMs;

            if (now - lastAccess > maxAgeMs) {
                freedBytes += stats.size;
                fs.unlinkSync(filePath);
                deleted++;
            }
        }

        if (deleted > 0) {
            logger.info(`[ImageCache] Cleanup: deleted ${deleted} images, freed ${Math.round(freedBytes / 1024)}KB`);
        }
    } catch (error) {
        logger.error(`[ImageCache] Cleanup error: error="${(error as Error).message}"`);
    }

    return { deleted, freed: freedBytes };
}

/**
 * Get cache stats
 */
export function getCacheStats(): { count: number; sizeBytes: number } {
    ensureCacheDir();

    let count = 0;
    let sizeBytes = 0;

    try {
        const files = fs.readdirSync(CACHE_DIR);
        count = files.length;

        for (const file of files) {
            const stats = fs.statSync(path.join(CACHE_DIR, file));
            sizeBytes += stats.size;
        }
    } catch {
        // Ignore errors
    }

    return { count, sizeBytes };
}

/**
 * Delete all cached TMDB images (used from Jobs & Cache settings)
 */
export function deleteAllCachedImages(): { deleted: number; freed: number } {
    ensureCacheDir();

    let deleted = 0;
    let freedBytes = 0;

    try {
        const files = fs.readdirSync(CACHE_DIR);
        for (const file of files) {
            const filePath = path.join(CACHE_DIR, file);
            const stats = fs.statSync(filePath);
            freedBytes += stats.size;
            fs.unlinkSync(filePath);
            deleted++;
        }
        logger.info(`[ImageCache] Flushed all: deleted=${deleted} freedKB=${Math.round(freedBytes / 1024)}`);
    } catch (error) {
        logger.error(`[ImageCache] Flush failed: error="${(error as Error).message}"`);
    }

    return { deleted, freed: freedBytes };
}

// Initialize cache directory on module load
ensureCacheDir();
