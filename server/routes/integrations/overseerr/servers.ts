/**
 * Overseerr Server Discovery Routes
 * 
 * Discovers connected Radarr/Sonarr servers from Overseerr configuration
 * and matches them to Framerr integration instances.
 * 
 * Endpoints:
 * - GET /:id/servers - Get Overseerr's connected Radarr/Sonarr servers
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../../middleware/auth';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { userHasIntegrationAccess } from '../../../db/integrationShares';
import logger from '../../../utils/logger';
import { getPlugin } from '../../../integrations/registry';
import { toPluginInstance } from '../../../integrations/utils';

const router = Router();
const adapter = getPlugin('overseerr')!.adapter;

interface OverseerrServer {
    id: number;
    name: string;
    hostname: string;
    port: number;
    apiKey: string;  // Used for matching to Framerr integrations
    useSsl?: boolean;
    externalUrl?: string;
    is4k?: boolean;
    isDefault?: boolean;
}

interface ServerMapping {
    overseerServerId: number;
    serverName: string;
    is4k: boolean;
    framerIntegrationId?: string;
    framerIntegrationName?: string;
}

interface ServerMapResponse {
    overseerrIntegrationId: string;
    overseerrName: string;
    radarrServers: ServerMapping[];
    sonarrServers: ServerMapping[];
}

/**
 * GET /:id/servers
 * Discover Overseerr's connected Radarr/Sonarr servers and match to Framerr integrations
 */
router.get('/:id/servers', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    // Get Overseerr instance
    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'overseerr') {
        res.status(404).json({ error: 'Overseerr integration not found' });
        return;
    }

    // Check access
    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('overseerr', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const pluginInstance = toPluginInstance(instance);

    if (!pluginInstance.config.url || !pluginInstance.config.apiKey) {
        res.status(400).json({ error: 'Invalid Overseerr configuration' });
        return;
    }

    try {
        // Fetch Radarr and Sonarr servers from Overseerr
        // Use /settings/ endpoints (not /service/) to get API keys for matching
        const [radarrResponse, sonarrResponse] = await Promise.all([
            adapter.get!(pluginInstance, '/api/v1/settings/radarr', {
                timeout: 10000,
            }).catch(() => ({ data: [] })),
            adapter.get!(pluginInstance, '/api/v1/settings/sonarr', {
                timeout: 10000,
            }).catch(() => ({ data: [] })),
        ]);

        const radarrServers: OverseerrServer[] = radarrResponse.data || [];
        const sonarrServers: OverseerrServer[] = sonarrResponse.data || [];

        // Get all Framerr Radarr and Sonarr integrations
        const framerRadarr = integrationInstancesDb.getInstancesByType('radarr').filter(i => i.enabled);
        const framerSonarr = integrationInstancesDb.getInstancesByType('sonarr').filter(i => i.enabled);

        // Match Overseerr servers to Framerr integrations by API key
        // This is irrefutable - same API key = same server instance
        const mappedRadarr: ServerMapping[] = radarrServers.map(server => {
            // Find Framerr integration with matching API key
            const matchedIntegration = framerRadarr.find(framer => {
                const framerApiKey = framer.config.apiKey as string;
                return framerApiKey && framerApiKey === server.apiKey;
            });

            return {
                overseerServerId: server.id,
                serverName: server.name,
                is4k: server.is4k || false,
                framerIntegrationId: matchedIntegration?.id,
                framerIntegrationName: matchedIntegration?.displayName
            };
        });

        const mappedSonarr: ServerMapping[] = sonarrServers.map(server => {
            // Find Framerr integration with matching API key
            const matchedIntegration = framerSonarr.find(framer => {
                const framerApiKey = framer.config.apiKey as string;
                return framerApiKey && framerApiKey === server.apiKey;
            });

            return {
                overseerServerId: server.id,
                serverName: server.name,
                is4k: server.is4k || false,
                framerIntegrationId: matchedIntegration?.id,
                framerIntegrationName: matchedIntegration?.displayName
            };
        });

        const response: ServerMapResponse = {
            overseerrIntegrationId: id,
            overseerrName: instance.displayName,
            radarrServers: mappedRadarr,
            sonarrServers: mappedSonarr
        };

        logger.debug(`[Overseerr Servers] Discovery: id=${id} radarr=${mappedRadarr.length}/${mappedRadarr.filter(s => s.framerIntegrationId).length} sonarr=${mappedSonarr.length}/${mappedSonarr.filter(s => s.framerIntegrationId).length}`);

        res.json(response);
    } catch (error) {
        logger.error(`[Overseerr Servers] Discovery error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to discover servers' });
    }
});

export default router;
