/**
 * Item Metadata Route
 * 
 * Unified endpoint for fetching media item metadata across all integration types.
 * Returns a normalized response regardless of whether the source is Plex, Jellyfin, or Emby.
 * 
 * GET /api/integrations/:id/item-metadata/:itemId
 */

import { Router, Request, Response } from 'express';
import logger from '../../../utils/logger';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';
import { PluginInstance } from '../../../integrations/types';
import { BaseAdapter } from '../../../integrations/BaseAdapter';
import { PlexAdapter } from '../../../integrations/plex/adapter';
import { JellyfinAdapter } from '../../../integrations/jellyfin/adapter';
import { EmbyAdapter } from '../../../integrations/emby/adapter';
import { toPluginInstance } from '../../../integrations/utils';

const router = Router();

// ============================================================================
// NORMALIZED RESPONSE TYPE
// ============================================================================

interface NormalizedMetadata {
    title: string;
    originalTitle?: string;
    year?: number;
    rating?: number;
    contentRating?: string;
    studio?: string;
    summary?: string;
    tagline?: string;
    genres: string[];
    directors: string[];
    writers: string[];
    cast: Array<{ name: string; role?: string }>;
    thumb?: string;
}

// ============================================================================
// PLEX METADATA FETCHER
// ============================================================================

async function fetchPlexMetadata(
    adapter: BaseAdapter,
    instance: PluginInstance,
    itemId: string
): Promise<NormalizedMetadata> {
    const response = await adapter.get(instance, `/library/metadata/${itemId}`, {
        timeout: 10000
    });

    const item = response.data?.MediaContainer?.Metadata?.[0];
    if (!item) throw new Error('Item not found');

    return {
        title: item.title || 'Unknown',
        originalTitle: item.originalTitle,
        year: item.year,
        rating: item.rating,
        contentRating: item.contentRating,
        studio: item.studio,
        summary: item.summary,
        tagline: item.tagline,
        genres: Array.isArray(item.Genre) ? item.Genre.map((g: { tag?: string }) => g.tag).filter(Boolean) : [],
        directors: Array.isArray(item.Director) ? item.Director.map((d: { tag?: string }) => d.tag).filter(Boolean) : [],
        writers: Array.isArray(item.Writer) ? item.Writer.map((w: { tag?: string }) => w.tag).filter(Boolean) : [],
        cast: Array.isArray(item.Role) ? item.Role.map((r: { tag?: string; role?: string }) => ({
            name: r.tag || '',
            role: r.role,
        })).filter((c: { name: string }) => c.name) : [],
        thumb: item.thumb,
    };
}

// ============================================================================
// JELLYFIN / EMBY METADATA FETCHER
// ============================================================================

async function fetchJellyfinMetadata(
    adapter: BaseAdapter,
    instance: PluginInstance,
    itemId: string
): Promise<NormalizedMetadata> {
    const userId = instance.config.userId as string;
    const response = await adapter.get(instance, `/Users/${userId}/Items/${itemId}`, {
        params: {
            Fields: 'Overview,Genres,Studios,People',
        },
        timeout: 10000
    });

    const item = response.data;
    if (!item) throw new Error('Item not found');

    // Extract people by type
    const people: Array<{ Name?: string; Role?: string; Type?: string }> = item.People || [];
    const directors = people.filter(p => p.Type === 'Director').map(p => p.Name).filter(Boolean) as string[];
    const writers = people.filter(p => p.Type === 'Writer').map(p => p.Name).filter(Boolean) as string[];
    const cast = people
        .filter(p => p.Type === 'Actor' || p.Type === 'GuestStar')
        .map(p => ({ name: p.Name || '', role: p.Role }))
        .filter(c => c.name);

    return {
        title: item.Name || 'Unknown',
        originalTitle: item.OriginalTitle,
        year: item.ProductionYear,
        rating: item.CommunityRating,
        contentRating: item.OfficialRating,
        studio: Array.isArray(item.Studios) && item.Studios.length > 0
            ? (item.Studios[0]?.Name || item.Studios[0])
            : undefined,
        summary: item.Overview,
        tagline: Array.isArray(item.Taglines) && item.Taglines.length > 0
            ? item.Taglines[0]
            : undefined,
        genres: Array.isArray(item.Genres) ? item.Genres : [],
        directors,
        writers,
        cast,
        // Jellyfin thumb is built from the item ID
        thumb: item.ImageTags?.Primary ? `/Items/${itemId}/Images/Primary` : undefined,
    };
}

// ============================================================================
// ROUTE
// ============================================================================

/**
 * GET /:id/item-metadata/:itemId - Get normalized item metadata
 */
router.get('/:id/item-metadata/:itemId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id, itemId } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance) {
        res.status(404).json({ error: 'Integration not found' });
        return;
    }

    // Access check
    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess(instance.type, req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    try {
        let metadata: NormalizedMetadata;
        const pluginInstance = toPluginInstance(instance);

        switch (instance.type) {
            case 'plex': {
                const adapter = new PlexAdapter();
                metadata = await fetchPlexMetadata(adapter, pluginInstance, itemId);
                break;
            }
            case 'jellyfin': {
                const adapter = new JellyfinAdapter();
                metadata = await fetchJellyfinMetadata(adapter, pluginInstance, itemId);
                break;
            }
            case 'emby': {
                const adapter = new EmbyAdapter();
                metadata = await fetchJellyfinMetadata(adapter, pluginInstance, itemId);
                break;
            }
            default:
                res.status(400).json({ error: `Unsupported integration type: ${instance.type}` });
                return;
        }

        // For Plex, thumb is a server path — prefix with proxy URL
        // For Jellyfin/Emby, thumb is already a proxy-ready path
        if (metadata.thumb) {
            metadata.thumb = `/api/integrations/${id}/proxy${metadata.thumb}`;
        }

        res.json(metadata);
    } catch (error) {
        logger.error(`[ItemMetadata] Fetch failed: type=${instance.type} itemId=${itemId} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch item metadata' });
    }
});

export default router;
