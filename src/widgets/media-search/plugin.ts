/**
 * Media Search Widget Plugin
 *
 * Search across media libraries (Plex, Jellyfin, Emby).
 * Supports multi-integration with grouped results.
 */

import { lazy } from 'react';
import { Search } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'media-search',
    name: 'Media Search',
    description: 'Search across your media libraries',
    category: 'media',
    icon: Search,
    sizing: {
        default: { w: 12, h: 1 },
        min: { w: 4, h: 1 },
        max: { w: 24, h: 2 },
    },
    component: lazy(() => import('./MediaSearchWidget')),
    compatibleIntegrations: ['plex', 'jellyfin', 'emby'],
    multiIntegration: true,
    defaultConfig: {
        showHeader: false, // Default h:1 can't display header (requires h:2)
        searchTakeover: true, // Spotlight-style search takeover mode
    },
    configConstraints: {
        headerHeightMode: 'hard',   // Height strictly controls header (h:1 = no header, h:2 = header)
        minHeightForHeader: 2,
        contentPadding: 'none',     // Widget handles its own padding
        options: [
            {
                key: 'searchTakeover',
                label: 'Focus Mode',
                type: 'toggle',
                defaultValue: true,
            }
        ]
    }
};

