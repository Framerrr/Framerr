/**
 * useMediaSearchConfig Hook
 *
 * Extracts config parsing from MediaSearchWidget.
 * Reads widget config and returns computed integration IDs and flags.
 */

import { useMemo } from 'react';

interface UseMediaSearchConfigOptions {
    widgetConfig: Record<string, unknown> | undefined;
    validIntegrationIds: Set<string>;
}

interface UseMediaSearchConfigReturn {
    configuredIntegrations: string[];
    overseerrIntegrationIds: string[];
    integrationNames: Record<string, string>;
    hideOverseerrAvailable: boolean;
    isTakeoverEnabled: boolean;
}

export function useMediaSearchConfig({
    widgetConfig,
    validIntegrationIds,
}: UseMediaSearchConfigOptions): UseMediaSearchConfigReturn {
    // Extract configured library integrations from widget config
    // Config uses groupKey: libraryIntegrationIds (array) from integrationGroups
    // Backward compat: also check legacy per-type keys (plexIntegrationIds, etc.)
    // Filter out any IDs that no longer exist (deleted integrations)
    const configuredIntegrations = useMemo(() => {
        const config = widgetConfig;
        if (!config) return [];

        const ids: string[] = [];

        // Primary: read from group key (new format)
        const groupIds = config.libraryIntegrationIds;
        if (Array.isArray(groupIds)) {
            ids.push(...groupIds as string[]);
        }

        // Backward compat: check legacy per-type keys if group key is empty
        if (ids.length === 0) {
            for (const type of ['plex', 'jellyfin', 'emby']) {
                const arrayKey = `${type}IntegrationIds`;
                const arrayValue = config[arrayKey];
                if (Array.isArray(arrayValue)) {
                    ids.push(...arrayValue as string[]);
                }

                const singularKey = `${type}IntegrationId`;
                const singularValue = config[singularKey];
                if (typeof singularValue === 'string' && singularValue) {
                    ids.push(singularValue);
                }
            }
        }

        // Filter out deleted/orphaned integration IDs
        if (validIntegrationIds.size > 0) {
            return ids.filter(id => validIntegrationIds.has(id));
        }
        return ids;
    }, [widgetConfig, validIntegrationIds]);

    // Extract configured Overseerr integration IDs (for request feature)
    const overseerrIntegrationIds = useMemo(() => {
        const config = widgetConfig;
        if (!config) return [];

        const ids: string[] = [];
        const groupIds = config.overseerrIntegrationIds;
        if (Array.isArray(groupIds)) {
            ids.push(...groupIds as string[]);
        }

        if (validIntegrationIds.size > 0) {
            return ids.filter(id => validIntegrationIds.has(id));
        }
        return ids;
    }, [widgetConfig, validIntegrationIds]);

    // Build integration names map (in real impl would come from integration instances)
    const integrationNames = useMemo(() => {
        const names: Record<string, string> = {};
        for (const id of configuredIntegrations) {
            names[id] = id; // Will be replaced with real names from integration query
        }
        return names;
    }, [configuredIntegrations]);

    // Read hideOverseerrAvailable from config (default: true)
    const hideOverseerrAvailable = widgetConfig?.hideOverseerrAvailable !== false;

    // Read takeover config (default: true)
    const isTakeoverEnabled = widgetConfig?.searchTakeover !== false;

    return {
        configuredIntegrations,
        overseerrIntegrationIds,
        integrationNames,
        hideOverseerrAvailable,
        isTakeoverEnabled,
    };
}
