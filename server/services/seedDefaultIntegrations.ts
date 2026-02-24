/**
 * Default Integration Seeding Service
 * 
 * Seeds a default set of integration instances on first startup.
 * These give new Framerr installations a populated service settings page
 * rather than an empty one. All defaults start disabled with empty config.
 * 
 * Idempotent: only creates defaults if zero instances exist.
 */

import logger from '../utils/logger';
import { createInstance, getInstanceCount } from '../db/integrationInstances';

/**
 * Default integrations to seed on fresh Framerr install.
 * Each gets one disabled, unconfigured instance.
 */
const DEFAULT_INTEGRATIONS = [
    { type: 'plex', displayName: 'Plex' },
    { type: 'sonarr', displayName: 'Sonarr' },
    { type: 'radarr', displayName: 'Radarr' },
    { type: 'overseerr', displayName: 'Seerr' },
    { type: 'monitor', displayName: 'Framerr Monitor' },
    { type: 'qbittorrent', displayName: 'qBittorrent' },
];

/**
 * Seed default integration instances if none exist yet.
 * Called once during server startup, after DB migrations.
 */
export function seedDefaultIntegrations(): void {
    const existingCount = getInstanceCount();

    if (existingCount > 0) {
        return;
    }

    for (const integration of DEFAULT_INTEGRATIONS) {
        try {
            createInstance({
                type: integration.type,
                displayName: integration.displayName,
                config: {},
                enabled: false,
            });
        } catch (error) {
            logger.error(`[DefaultIntegrations] Failed to create ${integration.displayName}: error="${(error as Error).message}"`);
        }
    }
}
