/**
 * System Icons Service
 * 
 * Manages bundled system icons (integration logos) served from assets.
 * Icons are stored in server/assets/system-icons/ and served via API.
 * No more seeding/copying to user's config directory.
 */

import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

// Bundled system icons directory (shipped with server)
const ASSETS_DIR = path.join(__dirname, '../assets/system-icons');

export interface SystemIconEntry {
    /** Kebab-case name matching the PNG filename (e.g. 'plex', 'home-assistant') */
    name: string;
    /** Human-readable display name */
    displayName: string;
    /** Category for grouping in the picker */
    category: 'media' | 'arr' | 'download' | 'network' | 'containers' | 'monitoring' | 'productivity';
}

/**
 * System icons registry — all bundled icons with metadata.
 * Names match the PNG filenames in server/assets/system-icons/.
 */
export const SYSTEM_ICONS: SystemIconEntry[] = [
    // Media
    { name: 'plex', displayName: 'Plex', category: 'media' },
    { name: 'jellyfin', displayName: 'Jellyfin', category: 'media' },
    { name: 'emby', displayName: 'Emby', category: 'media' },
    { name: 'tautulli', displayName: 'Tautulli', category: 'media' },
    { name: 'stash', displayName: 'Stash', category: 'media' },
    { name: 'audiobookshelf', displayName: 'Audiobookshelf', category: 'media' },
    { name: 'navidrome', displayName: 'Navidrome', category: 'media' },
    { name: 'kavita', displayName: 'Kavita', category: 'media' },
    { name: 'calibre-web', displayName: 'Calibre Web', category: 'media' },

    // Arr Suite
    { name: 'sonarr', displayName: 'Sonarr', category: 'arr' },
    { name: 'radarr', displayName: 'Radarr', category: 'arr' },
    { name: 'lidarr', displayName: 'Lidarr', category: 'arr' },
    { name: 'prowlarr', displayName: 'Prowlarr', category: 'arr' },
    { name: 'bazarr', displayName: 'Bazarr', category: 'arr' },
    { name: 'readarr', displayName: 'Readarr', category: 'arr' },
    { name: 'whisparr', displayName: 'Whisparr', category: 'arr' },
    { name: 'overseerr', displayName: 'Seerr', category: 'arr' },
    { name: 'ombi', displayName: 'Ombi', category: 'arr' },
    { name: 'petio', displayName: 'Petio', category: 'arr' },
    { name: 'autobrr', displayName: 'Autobrr', category: 'arr' },

    // Download Clients
    { name: 'qbittorrent', displayName: 'qBittorrent', category: 'download' },
    { name: 'transmission', displayName: 'Transmission', category: 'download' },
    { name: 'deluge', displayName: 'Deluge', category: 'download' },
    { name: 'sabnzbd', displayName: 'SABnzbd', category: 'download' },
    { name: 'nzbget', displayName: 'NZBGet', category: 'download' },

    // Network / Infrastructure
    { name: 'nginx-proxy-manager', displayName: 'Nginx Proxy Manager', category: 'network' },
    { name: 'traefik', displayName: 'Traefik', category: 'network' },
    { name: 'caddy', displayName: 'Caddy', category: 'network' },
    { name: 'pi-hole', displayName: 'Pi-hole', category: 'network' },
    { name: 'adguard-home', displayName: 'AdGuard Home', category: 'network' },
    { name: 'wireguard', displayName: 'WireGuard', category: 'network' },
    { name: 'tailscale', displayName: 'Tailscale', category: 'network' },
    { name: 'cloudflare', displayName: 'Cloudflare', category: 'network' },
    { name: 'unifi', displayName: 'UniFi', category: 'network' },

    // Containers / OS
    { name: 'portainer', displayName: 'Portainer', category: 'containers' },
    { name: 'docker', displayName: 'Docker', category: 'containers' },
    { name: 'proxmox', displayName: 'Proxmox', category: 'containers' },
    { name: 'unraid', displayName: 'Unraid', category: 'containers' },
    { name: 'truenas', displayName: 'TrueNAS', category: 'containers' },
    { name: 'casaos', displayName: 'CasaOS', category: 'containers' },

    // Monitoring
    { name: 'grafana', displayName: 'Grafana', category: 'monitoring' },
    { name: 'prometheus', displayName: 'Prometheus', category: 'monitoring' },
    { name: 'uptime-kuma', displayName: 'Uptime Kuma', category: 'monitoring' },
    { name: 'netdata', displayName: 'Netdata', category: 'monitoring' },
    { name: 'dozzle', displayName: 'Dozzle', category: 'monitoring' },
    { name: 'glances', displayName: 'Glances', category: 'monitoring' },
    { name: 'framerr', displayName: 'Framerr', category: 'monitoring' },

    // Productivity / Auth
    { name: 'nextcloud', displayName: 'Nextcloud', category: 'productivity' },
    { name: 'vaultwarden', displayName: 'Vaultwarden', category: 'productivity' },
    { name: 'gitea', displayName: 'Gitea', category: 'productivity' },
    { name: 'authentik', displayName: 'Authentik', category: 'productivity' },
    { name: 'authelia', displayName: 'Authelia', category: 'productivity' },
    { name: 'home-assistant', displayName: 'Home Assistant', category: 'productivity' },
];

// Build a lookup map for quick access
const SYSTEM_ICON_MAP = new Map<string, SystemIconEntry>(
    SYSTEM_ICONS.map(icon => [icon.name, icon])
);

/**
 * Get the absolute file path for a bundled system icon
 */
export function getSystemIconPath(name: string): string | null {
    const entry = SYSTEM_ICON_MAP.get(name);
    if (!entry) return null;

    const filePath = path.join(ASSETS_DIR, `${name}.png`);
    if (!fs.existsSync(filePath)) {
        logger.warn(`[SystemIcons] Icon file missing for registered icon: ${name}`);
        return null;
    }
    return filePath;
}

/**
 * List all bundled system icons
 */
export function listSystemIcons(): SystemIconEntry[] {
    return SYSTEM_ICONS;
}

/**
 * Check if a name is a registered system icon
 */
export function isSystemIcon(name: string): boolean {
    return SYSTEM_ICON_MAP.has(name);
}

/**
 * Get the system icon ID for a service (for use in notifications/webhooks).
 * Returns the icon value string like "system:plex".
 */
export function getSystemIconIdForService(service: string): string | null {
    // Direct match
    if (SYSTEM_ICON_MAP.has(service.toLowerCase())) {
        return `system:${service.toLowerCase()}`;
    }

    // Alias map for services that don't match icon names exactly
    const aliases: Record<string, string> = {
        'home-assistant': 'home-assistant',
        'homeassistant': 'home-assistant',
        'pihole': 'pi-hole',
        'adguardhome': 'adguard-home',
        'uptimekuma': 'uptime-kuma',
        'nginxproxymanager': 'nginx-proxy-manager',
    };

    const mapped = aliases[service.toLowerCase()];
    if (mapped && SYSTEM_ICON_MAP.has(mapped)) {
        return `system:${mapped}`;
    }

    return null;
}
