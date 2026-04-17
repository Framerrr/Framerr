/**
 * useMediaServerMeta Hook — Shared
 *
 * Fetches machineId (Plex) and serverUrl (Jellyfin/Emby) for one or more
 * integration instances. Used by both media-stream and media-search widgets.
 *
 * - Plex: fetches machineIdentifier from /proxy/machineId XML response
 * - Jellyfin/Emby: fetches web URL from /api/media/web-urls
 */

import { useState, useEffect } from 'react';
import api from '../../api/client';
import { apiClient } from '../../api/client';
import logger from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface UseMediaServerMetaReturn {
    /** Plex machineIdentifier keyed by integrationId */
    machineIds: Record<string, string>;
    /** Jellyfin/Emby server web URLs keyed by integrationId */
    serverUrls: Record<string, string>;
    /** Emby server identifiers keyed by integrationId */
    serverIds: Record<string, string>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Fetch server metadata for one or more integration IDs.
 *
 * @param integrationIds - Array of integration instance IDs to fetch metadata for
 * @param widgetName - Widget name for logging (e.g., 'media-stream', 'media-search')
 */
export function useMediaServerMeta(
    integrationIds: string[],
    widgetName: string
): UseMediaServerMetaReturn {
    const [machineIds, setMachineIds] = useState<Record<string, string>>({});
    const [serverUrls, setServerUrls] = useState<Record<string, string>>({});
    const [serverIds, setServerIds] = useState<Record<string, string>>({});

    // Stable key for dependency tracking
    const idsKey = integrationIds.join(',');

    // Fetch machine IDs for Plex integrations
    useEffect(() => {
        const plexIds = integrationIds.filter(id => id.startsWith('plex-'));
        if (plexIds.length === 0) {
            setMachineIds({});
            return;
        }

        const fetchMachineIds = async () => {
            const result: Record<string, string> = {};

            await Promise.all(plexIds.map(async (integrationId) => {
                try {
                    const response = await apiClient.get(
                        `/api/integrations/${integrationId}/proxy/machineId`,
                        {
                            headers: { 'X-Widget-Type': widgetName },
                            responseType: 'text',
                        }
                    );
                    const xml = response.data as string;
                    const match = xml.match(/machineIdentifier="([^"]+)"/);
                    if (match) {
                        result[integrationId] = match[1];
                    }
                } catch (err) {
                    logger.error(`[${widgetName}] Error fetching machine ID`, {
                        error: (err as Error).message,
                        integrationId,
                    });
                }
            }));

            setMachineIds(prev => ({ ...prev, ...result }));
        };

        fetchMachineIds();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey, widgetName]);

    // Fetch server web URLs for Jellyfin/Emby integrations
    useEffect(() => {
        if (integrationIds.length === 0) {
            setServerUrls({});
            return;
        }

        const fetchWebUrls = async () => {
            try {
                const data = await api.get<{ webUrls?: Record<string, string>; serverIds?: Record<string, string> }>(
                    `/api/media/web-urls?integrations=${integrationIds.join(',')}`,
                    { headers: { 'X-Widget-Type': widgetName } }
                );
                if (data.webUrls) {
                    setServerUrls(data.webUrls);
                }
                if (data.serverIds) {
                    setServerIds(data.serverIds);
                }
            } catch (err) {
                logger.error(`[${widgetName}] Error fetching server URLs`, {
                    error: (err as Error).message,
                });
            }
        };

        fetchWebUrls();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey, widgetName]);

    return { machineIds, serverUrls, serverIds };
}
