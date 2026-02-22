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
import { widgetFetch } from '../../utils/widgetFetch';
import logger from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface UseMediaServerMetaReturn {
    /** Plex machineIdentifier keyed by integrationId */
    machineIds: Record<string, string>;
    /** Jellyfin/Emby server web URLs keyed by integrationId */
    serverUrls: Record<string, string>;
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
                    const response = await widgetFetch(
                        `/api/integrations/${integrationId}/proxy/machineId`,
                        widgetName
                    );
                    if (response.ok) {
                        const xml = await response.text();
                        const match = xml.match(/machineIdentifier="([^"]+)"/);
                        if (match) {
                            result[integrationId] = match[1];
                        }
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
                const response = await widgetFetch(
                    `/api/media/web-urls?integrations=${integrationIds.join(',')}`,
                    widgetName
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data.webUrls) {
                        setServerUrls(data.webUrls);
                    }
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

    return { machineIds, serverUrls };
}
