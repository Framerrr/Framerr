/**
 * Icons API Routes
 * 
 * Serves bundled system icons and the CDN catalog manifest.
 * System icons are served from server/assets/system-icons/.
 * CDN catalog is a static JSON of all available dashboard-icons names.
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';
import { listSystemIcons, getSystemIconPath } from '../services/systemIcons';

const router = Router();

// Load CDN catalog once at startup
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
let cdnCatalog: string[] = [];
try {
    const catalogPath = path.join(DATA_DIR, 'icon-catalog.json');
    if (fs.existsSync(catalogPath)) {
        cdnCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
        logger.info(`[Icons] Loaded CDN catalog: ${cdnCatalog.length} icons`);
    } else {
        logger.warn('[Icons] CDN catalog not found at ' + catalogPath);
    }
} catch (err) {
    logger.error(`[Icons] Failed to load CDN catalog: ${(err as Error).message}`);
}

/**
 * GET /api/icons/system - List all bundled system icons
 */
router.get('/system', (req: Request, res: Response) => {
    const icons = listSystemIcons();
    res.json({ icons });
});

/**
 * GET /api/icons/system/:name/file - Serve a bundled system icon PNG
 */
router.get('/system/:name/file', (req: Request, res: Response) => {
    const { name } = req.params;

    // Sanitize name to prevent path traversal
    const safeName = name.replace(/[^a-z0-9-]/gi, '');
    if (safeName !== name) {
        res.status(400).json({ error: 'Invalid icon name' });
        return;
    }

    const filePath = getSystemIconPath(safeName);
    if (!filePath) {
        res.status(404).json({ error: 'System icon not found' });
        return;
    }

    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h cache
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(filePath);
});

/**
 * GET /api/icons/catalog - Return CDN catalog (all available icon names)
 * Used by frontend for search. Cached aggressively.
 */
router.get('/catalog', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1h cache
    res.json({ icons: cdnCatalog });
});

export default router;
