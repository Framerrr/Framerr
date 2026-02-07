/**
 * Media Stream Widget Plugin
 *
 * Displays active streaming sessions from Plex, Jellyfin, or Emby.
 * Single-instance widget with multi-integration support.
 *
 * Phase 4: Refactored from Plex-only to support all media servers.
 */

import { lazy } from 'react';
import { Tv } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'media-stream',
    name: 'Media Stream',
    description: 'Now playing from Plex, Jellyfin, or Emby',
    category: 'media',
    icon: Tv,
    sizing: {
        default: { w: 12, h: 6 },
        min: { w: 6, h: 6 },
        max: { w: 24, h: 10 },
    },
    component: lazy(() => import('./MediaStreamWidget')),
    compatibleIntegrations: ['plex', 'jellyfin', 'emby'],
    configConstraints: {
        options: [
            { key: 'hideWhenEmpty', label: 'Hide when no streams', type: 'toggle', defaultValue: true }
        ]
    }
};
