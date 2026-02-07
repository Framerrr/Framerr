/**
 * useOverseerrServerMapping
 * 
 * Fetches the server mapping for an Overseerr integration.
 * Maps Overseerr's `/settings/radarr` and `/settings/sonarr` servers
 * to Framerr integration instances by matching API keys.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

/** A single server mapping from Overseerr server to Framerr integration */
export interface ServerMapping {
    overseerServerId: number;
    serverName: string;
    hostname: string;
    port: number;
    is4k: boolean;
    /** Framerr integration ID if matched, undefined if no match */
    framerIntegrationId?: string;
    /** Display name of matching Framerr integration */
    framerIntegrationName?: string;
}

/** Response from /api/integrations/:id/servers */
export interface ServerMapResponse {
    overseerrIntegrationId: string;
    overseerrName: string;
    radarrServers: ServerMapping[];
    sonarrServers: ServerMapping[];
}

/**
 * Fetch Overseerr server mappings.
 * 
 * Returns which Radarr/Sonarr servers are connected to Overseerr
 * and their corresponding Framerr integration IDs (if matched).
 * 
 * @param overseerrId - The Overseerr integration ID to fetch mappings for
 */
export function useOverseerrServerMapping(overseerrId: string | undefined) {
    return useQuery({
        queryKey: ['overseerr-server-mapping', overseerrId],
        queryFn: async () => {
            const response = await apiClient.get<ServerMapResponse>(
                `/api/integrations/${overseerrId}/servers`
            );
            return response.data;
        },
        enabled: !!overseerrId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        gcTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
    });
}

/**
 * Extract matched Framerr integration IDs from server mapping.
 * 
 * @param serverMapping - The server mapping response
 * @returns Object with arrays of matched Radarr and Sonarr IDs
 */
export function getMatchedIntegrationIds(serverMapping: ServerMapResponse | undefined) {
    if (!serverMapping) {
        return { radarrIds: [], sonarrIds: [] };
    }

    const radarrIds = serverMapping.radarrServers
        .filter(s => s.framerIntegrationId)
        .map(s => s.framerIntegrationId!);

    const sonarrIds = serverMapping.sonarrServers
        .filter(s => s.framerIntegrationId)
        .map(s => s.framerIntegrationId!);

    return { radarrIds, sonarrIds };
}

/**
 * Build a lookup map from Overseerr serverId to Framerr integrationId.
 * Used to correlate request.serverId with the correct queue data.
 * 
 * @param serverMapping - The server mapping response
 * @returns Map from Overseerr serverId to Framerr integrationId
 */
export function buildServerIdLookup(
    serverMapping: ServerMapResponse | undefined
): Map<number, { framerIntegrationId: string; is4k: boolean; type: 'radarr' | 'sonarr' }> {
    const lookup = new Map<number, { framerIntegrationId: string; is4k: boolean; type: 'radarr' | 'sonarr' }>();

    if (!serverMapping) return lookup;

    for (const server of serverMapping.radarrServers) {
        if (server.framerIntegrationId) {
            lookup.set(server.overseerServerId, {
                framerIntegrationId: server.framerIntegrationId,
                is4k: server.is4k,
                type: 'radarr'
            });
        }
    }

    for (const server of serverMapping.sonarrServers) {
        if (server.framerIntegrationId) {
            lookup.set(server.overseerServerId, {
                framerIntegrationId: server.framerIntegrationId,
                is4k: server.is4k,
                type: 'sonarr'
            });
        }
    }

    return lookup;
}
