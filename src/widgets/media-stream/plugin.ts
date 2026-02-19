/**
 * Media Stream Widget Plugin
 *
 * Displays active streaming sessions from Plex, Jellyfin, or Emby.
 * Supports Carousel (horizontal scroll) and Stacked (vertical scroll) modes.
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
        min: { w: 4, h: 4 },
        max: { w: 24, h: 10 },
    },
    component: lazy(() => import('./MediaStreamWidget')),
    compatibleIntegrations: ['plex', 'jellyfin', 'emby'],
    defaultConfig: {
        viewMode: 'auto',
        hideWhenEmpty: true,
    },
    configConstraints: {
        options: [
            {
                key: 'viewMode',
                label: 'View Mode',
                type: 'buttons',
                defaultValue: 'auto',
                choices: [
                    { value: 'auto', label: 'Auto' },
                    { value: 'carousel', label: 'Carousel' },
                    { value: 'stacked', label: 'Stacked' },
                ]
            },
            { key: 'hideWhenEmpty', label: 'Hide when no streams', type: 'toggle', defaultValue: true }
        ]
    }
};
