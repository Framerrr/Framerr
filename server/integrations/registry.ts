/**
 * Integration Plugin Registry
 *
 * Central registry of all integration plugins for auto-discovery.
 * Phase 4.4: Manual imports. Phase 4.5 will use import.meta.glob.
 */

import { IntegrationPlugin } from './types';

// Import all plugins
import { plugin as sonarr } from './sonarr';
import { plugin as radarr } from './radarr';
import { plugin as plex } from './plex';
import { plugin as jellyfin } from './jellyfin';
import { plugin as emby } from './emby';
import { plugin as overseerr } from './overseerr';
import { plugin as qbittorrent } from './qbittorrent';
import { plugin as glances } from './glances';
import { plugin as customsystemstatus } from './customsystemstatus';
import { plugin as monitor } from './monitor';
import { plugin as uptimekuma } from './uptimekuma';
import { plugin as unraid } from './unraid';
import { plugin as tautulli } from './tautulli';
import { plugin as sabnzbd } from './sabnzbd';

// All registered plugins
export const plugins: IntegrationPlugin[] = [
    sonarr,
    radarr,
    plex,
    jellyfin,
    emby,
    overseerr,
    qbittorrent,
    glances,
    customsystemstatus,
    monitor,
    uptimekuma,
    unraid,
    tautulli,
    sabnzbd,
];

// Map for O(1) lookup by ID
export const pluginMap = new Map<string, IntegrationPlugin>(
    plugins.map(p => [p.id, p])
);

// Get plugin by ID
export const getPlugin = (id: string): IntegrationPlugin | undefined => {
    return pluginMap.get(id);
};
