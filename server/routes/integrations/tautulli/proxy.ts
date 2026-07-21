/**
 * Tautulli Proxy Routes
 *
 * Handles Tautulli-specific API proxying:
 * - /image - Proxy poster images via Tautulli's pms_image_proxy
 * - /stats - On-demand get_home_stats fetch with a per-request time_range
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import sharp from 'sharp';
import { httpsAgent } from '../../../utils/httpsAgent';
import { translateHostUrl } from '../../../utils/urlHelper';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import logger from '../../../utils/logger';
import { toPluginInstance } from '../../../integrations/utils';
import { TautulliAdapter } from '../../../integrations/tautulli/adapter';
import { callTautulli, mapStatsCategories, type TautulliStatCategory } from '../../../integrations/tautulli/poller';

const router = Router();
const tautulliAdapter = new TautulliAdapter();

/** Tautulli has no dedicated "all time" flag — a large day count approximates it. */
const MAX_TIME_RANGE_DAYS = 36500;
const DEFAULT_TIME_RANGE_DAYS = 30;

/** How many hero candidates to enrich with real backdrop paths per category */
const ART_ENRICH_LIMIT = 8;

const ART_ENRICH_STAT_IDS = new Set(['top_tv', 'top_movies', 'popular_tv', 'popular_movies']);

/**
 * get_home_stats rarely includes `art` for TV (poster thumb only). Recently
 * Added works because get_recently_added returns a real /art/ path. Resolve
 * the same path via get_metadata for the featured band rows.
 */
async function enrichCategoryArt(
    pluginInstance: ReturnType<typeof toPluginInstance>,
    category: TautulliStatCategory,
): Promise<TautulliStatCategory> {
    if (!ART_ENRICH_STAT_IDS.has(category.statId)) return category;

    const rows = category.rows.map((row) => ({ ...row }));
    const targets = rows
        .slice(0, ART_ENRICH_LIMIT)
        .filter((row) => row.ratingKey > 0 && !(row.art && row.art.includes('/art/')));

    await Promise.all(targets.map(async (row) => {
        try {
            const meta = await callTautulli(pluginInstance, tautulliAdapter, 'get_metadata', {
                rating_key: String(row.ratingKey),
            }) as Record<string, unknown> | null;

            const art = meta?.art ? String(meta.art) : '';
            if (art.includes('/art/')) {
                row.art = art;
                return;
            }

            // Episode metadata sometimes omits art — climb to the show.
            const showKey = meta?.grandparent_rating_key
                ? String(meta.grandparent_rating_key)
                : '';
            if (!showKey || showKey === String(row.ratingKey)) return;

            const showMeta = await callTautulli(pluginInstance, tautulliAdapter, 'get_metadata', {
                rating_key: showKey,
            }) as Record<string, unknown> | null;
            const showArt = showMeta?.art ? String(showMeta.art) : '';
            if (showArt.includes('/art/')) {
                row.art = showArt;
            }
        } catch (err) {
            logger.warn(
                `[Tautulli Proxy] Art enrich failed for rating_key=${row.ratingKey}: ${(err as Error).message}`
            );
        }
    }));

    return { ...category, rows };
}

/**
 * Real fanart is landscape. Missing art often comes back as Tautulli's Plex-logo
 * placeholder with HTTP 200 — reject those so the client can fall back to poster.
 */
async function isUsableLandscapeArt(buffer: Buffer): Promise<boolean> {
    try {
        const meta = await sharp(buffer).metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;
        if (w < 400 || h < 200) return false;
        return w / h >= 1.25;
    } catch {
        return false;
    }
}

/**
 * GET /:id/proxy/tautulli-image - Proxy Tautulli poster / backdrop images
 *
 * Uses Tautulli's built-in pms_image_proxy.
 * Query params:
 *   - img: Plex path (e.g. /library/metadata/12345/thumb/1234567890)
 *   - ratingKey: Plex rating key — preferred for art when get_home_stats
 *     only returns a poster thumb (rewriting /thumb/→/art/ keeps the wrong
 *     cache-buster and 400s). Tautulli builds /library/metadata/{key}/art.
 *   - imgType: `art` | `thumb` (default thumb when using ratingKey alone)
 *   - width / height: optional resize targets
 *   - fallback: Tautulli fallback type, or `none` to omit placeholders
 */
router.get('/:id/proxy/tautulli-image', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const {
        img,
        width = '300',
        height = '450',
        fallback = 'poster',
        ratingKey,
        imgType,
    } = req.query;

    const imgPath = typeof img === 'string' && img.length > 0 ? img : null;
    const rk = typeof ratingKey === 'string' && ratingKey.length > 0
        ? ratingKey
        : (typeof ratingKey === 'number' ? String(ratingKey) : null);

    if (!imgPath && !rk) {
        res.status(400).json({ error: 'Image path (img) or ratingKey required' });
        return;
    }

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'tautulli') {
        res.status(404).json({ error: 'Tautulli integration not found' });
        return;
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Tautulli configuration' });
        return;
    }

    try {
        const baseUrl = translateHostUrl(url.replace(/\/$/, ''));
        const imageUrl = `${baseUrl}/api/v2`;
        const wantArt = imgType === 'art' || (imgPath != null && imgPath.includes('/art/'));
        const rkFromImg = imgPath?.match(/\/library\/metadata\/(\d+)\//)?.[1] ?? null;
        const effectiveRk = rk || rkFromImg;

        // Never omit fallback on art fetches — Tautulli returns HTTP 400 when PMS
        // art is missing and fallback is absent. Recently Added works because it
        // keeps the default poster/art fallback; we still reject placeholders via
        // isUsableLandscapeArt so the client can swap to the real poster.
        let tautulliFallback: string;
        if (wantArt) {
            tautulliFallback = 'art';
        } else if (fallback === 'none' || fallback === '' || fallback === 'false') {
            tautulliFallback = 'poster';
        } else if (typeof fallback === 'string' && fallback.length > 0) {
            tautulliFallback = fallback;
        } else {
            tautulliFallback = 'poster';
        }

        const imageParams: Record<string, string> = {
            apikey: apiKey,
            width: String(width),
            height: String(height),
            fallback: tautulliFallback,
            ...(imgPath ? { img: imgPath } : {}),
            ...(effectiveRk ? { rating_key: effectiveRk } : {}),
            // rating_key-only art: Tautulli builds /library/metadata/{key}/art
            ...(!imgPath && effectiveRk && wantArt ? { fallback: 'art' } : {}),
        };

        const axiosOpts = {
            responseType: 'arraybuffer' as const,
            httpsAgent,
            timeout: 15000,
            // Tautulli may 400 on api/v2 image misses; allow reading the body
            validateStatus: (status: number) => status >= 200 && status < 300,
        };

        let response;
        try {
            response = await axios.get(imageUrl, {
                params: { cmd: 'pms_image_proxy', ...imageParams },
                ...axiosOpts,
            });
        } catch (apiErr) {
            // Some Tautulli installs serve images on /pms_image_proxy but 400 on api/v2
            if (axios.isAxiosError(apiErr) && apiErr.response?.status === 400) {
                response = await axios.get(`${baseUrl}/pms_image_proxy`, {
                    params: imageParams,
                    ...axiosOpts,
                });
            } else {
                throw apiErr;
            }
        }

        let buffer = Buffer.from(response.data);

        if (wantArt) {
            // Default Tautulli art.png placeholders are tiny; real fanart is larger.
            if (buffer.length < 8000 || !(await isUsableLandscapeArt(buffer))) {
                res.status(404).json({ error: 'No usable landscape art' });
                return;
            }
            const targetW = Math.max(1, parseInt(String(width), 10) || 960);
            const targetH = Math.max(1, parseInt(String(height), 10) || 540);
            buffer = await sharp(buffer)
                .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
                .jpeg({ quality: 85 })
                .toBuffer();
            res.set('Content-Type', 'image/jpeg');
        } else {
            res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        }

        res.set('Cache-Control', 'public, max-age=14400');
        res.send(buffer);
    } catch (error) {
        const detail = axios.isAxiosError(error)
            ? `status=${error.response?.status} img=${imgPath ?? ''} ratingKey=${rk ?? ''} imgType=${String(imgType ?? '')}`
            : (error as Error).message;
        logger.error(`[Tautulli Proxy] Image error: ${detail}`);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

/**
 * GET /:id/proxy/stats - On-demand Top Movies/TV/Users fetch
 *
 * Query params:
 *   - timeRange: days of history to aggregate (clamped to [1, 36500]; 36500
 *     is the practical "All Time" value since Tautulli has no dedicated flag)
 *   - count: rows per stat category (clamped to [5, 55]; covers list + heroes)
 *
 * Available to all authenticated users (read-only data, not a privileged
 * action) — matches Radarr's /proxy/missing and /proxy/cutoff precedent.
 */
router.get('/:id/proxy/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'tautulli') {
        res.status(404).json({ error: 'Tautulli integration not found' });
        return;
    }

    const rawTimeRange = parseInt(req.query.timeRange as string, 10);
    const timeRange = Number.isFinite(rawTimeRange)
        ? Math.min(Math.max(rawTimeRange, 1), MAX_TIME_RANGE_DAYS)
        : DEFAULT_TIME_RANGE_DAYS;

    // stats_count must cover featured heroes (≤5) + configured list items (≤50)
    const rawCount = parseInt(req.query.count as string, 10);
    const statsCount = Number.isFinite(rawCount)
        ? Math.min(Math.max(rawCount, 5), 55)
        : 55;

    try {
        const pluginInstance = toPluginInstance(instance);
        const data = await callTautulli(pluginInstance, tautulliAdapter, 'get_home_stats', {
            stats_count: statsCount,
            time_range: timeRange,
            stats_type: 'plays',
        });
        const categories = mapStatsCategories(data);
        // Attach real /art/ paths for hero cards (get_home_stats usually omits them)
        const enriched = await Promise.all(
            categories.map((cat) => enrichCategoryArt(pluginInstance, cat))
        );
        res.json(enriched);
    } catch (error) {
        logger.error(`[Tautulli Proxy] Stats error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;
