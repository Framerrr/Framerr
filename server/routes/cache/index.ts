/**
 * Cache Routes
 * 
 * Serves cached images to the frontend.
 * 
 * NOTE: These routes intentionally do NOT use requireAuth because:
 * 1. Browser <img> tags cannot send Authorization headers
 * 2. Behind proxy auth (Authentik/etc), sub-resource requests may not carry auth headers
 * 3. These images are already security-gated: they were fetched server-side using
 *    the user's integration credentials. The cached files are just poster art thumbnails.
 * 4. Filenames are validated against strict patterns to prevent path traversal.
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { getDb } from '../../database/db';
import { getInstanceById } from '../../db/integrationInstances';
import {
    getOrFetchLargeImage,
    getOrFetchLargeImageJellyfinEmby,
    getLargeImagePath,
    isLargeImageCached
} from '../../services/libraryImageCache';
import { translateHostUrl } from '../../utils/urlHelper';

const router = Router();

// Use DATA_DIR from environment or default to server/data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const CACHE_DIR = path.join(DATA_DIR, 'cache', 'images');
const LIBRARY_CACHE_DIR = path.join(DATA_DIR, 'cache', 'library');

/**
 * GET /api/cache/images/:filename
 * 
 * Serve a cached TMDB image file (no auth required - see module comment)
 */
router.get('/images/:filename', (req: Request, res: Response): void => {
    const { filename } = req.params;

    // Security: Only allow specific filename patterns (tmdb_*_*.jpg)
    if (!/^tmdb_\d+_(poster|backdrop)\.jpg$/.test(filename)) {
        res.status(400).json({ error: 'Invalid filename format' });
        return;
    }

    const filePath = path.join(CACHE_DIR, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Image not found' });
        return;
    }

    // Set cache headers (1 day — prevents browser from accumulating poster images indefinitely)
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'image/jpeg');

    // Stream the file
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});

/**
 * GET /api/cache/library/:integrationId/:filename
 * 
 * Serve a cached library image (Plex/Jellyfin/Emby thumbnails)
 * No auth required - see module comment
 * Query params:
 *   - size=lg: Fetch/serve large image (480x720) with LRU caching
 */
router.get('/library/:integrationId/:filename', async (req: Request, res: Response): Promise<void> => {
    const { integrationId, filename } = req.params;
    const { size } = req.query;

    // Security: Validate integrationId and filename format
    if (!/^[a-zA-Z0-9-_]+$/.test(integrationId)) {
        res.status(400).json({ error: 'Invalid integration ID' });
        return;
    }

    // Filename should end with .jpg and not contain path traversal
    if (!/^[a-zA-Z0-9-_]+\.jpg$/.test(filename) || filename.includes('..')) {
        res.status(400).json({ error: 'Invalid filename format' });
        return;
    }

    // Extract itemKey from filename (remove .jpg extension)
    const itemKey = filename.replace('.jpg', '');

    // Handle large image request
    if (size === 'lg') {
        try {
            // Check if already cached
            if (isLargeImageCached(integrationId, itemKey)) {
                const largeFilePath = getLargeImagePath(integrationId, itemKey);
                // Touch for LRU
                const now = new Date();
                try { fs.utimesSync(largeFilePath, now, now); } catch { /* ignore */ }

                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.setHeader('Content-Type', 'image/jpeg');
                const stream = fs.createReadStream(largeFilePath);
                stream.pipe(res);
                return;
            }

            // Need to fetch from media server — get thumb path from database
            const db = getDb();
            const row = db.prepare(`
                SELECT thumb FROM media_library 
                WHERE integration_instance_id = ? AND item_key = ?
            `).get(integrationId, itemKey) as { thumb: string } | undefined;

            if (!row?.thumb) {
                res.status(404).json({ error: 'Media item not found' });
                return;
            }

            // Get integration credentials
            const instance = getInstanceById(integrationId);
            if (!instance) {
                res.status(400).json({ error: 'Integration not found' });
                return;
            }

            let filePath: string | null = null;
            const baseUrl = translateHostUrl(instance.config.url as string);

            if (instance.type === 'plex') {
                const plexToken = instance.config.token as string;
                filePath = await getOrFetchLargeImage(
                    integrationId,
                    itemKey,
                    baseUrl,
                    plexToken,
                    row.thumb
                );
            } else if (instance.type === 'jellyfin' || instance.type === 'emby') {
                const apiKey = instance.config.apiKey as string;
                filePath = await getOrFetchLargeImageJellyfinEmby(
                    integrationId,
                    itemKey,
                    baseUrl,
                    instance.type,
                    apiKey
                );
            } else {
                res.status(400).json({ error: `Unsupported integration type: ${instance.type}` });
                return;
            }

            if (!filePath) {
                res.status(500).json({ error: 'Failed to fetch large image' });
                return;
            }

            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Content-Type', 'image/jpeg');
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
            return;
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
    }

    // Standard small image (sync'd thumbnail)
    const filePath = path.join(LIBRARY_CACHE_DIR, integrationId, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Image not found' });
        return;
    }

    // Set cache headers (1 day for library images - they can change more often)
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'image/jpeg');

    // Stream the file
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});

export default router;

