/**
 * qBittorrent Widget Plugin
 *
 * Torrent downloads and management.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Download } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'qbittorrent',
    name: 'qBittorrent',
    description: 'Torrent downloads and management',
    category: 'downloads',
    icon: Download,
    sizing: {
        default: { w: 6, h: 6 },
        min: { w: 6, h: 3 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./QBittorrentWidget')),
    compatibleIntegrations: ['qbittorrent'],
    configConstraints: {
        contentPadding: 'lg',  // Relaxed padding for list layout
    },
};
