/**
 * Downloads Widget Plugin
 *
 * Unified downloads widget supporting both qBittorrent and SABnzbd.
 * Compatible with both integration types — the widget detects which
 * client is bound and adapts its rendering accordingly.
 */

import { lazy } from 'react';
import { Download } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'downloads',
    name: 'Downloads',
    description: 'Download management for qBittorrent and SABnzbd',
    category: 'downloads',
    icon: Download,
    sizing: {
        default: { w: 6, h: 6 },
        min: { w: 6, h: 3 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./DownloadsWidget')),
    compatibleIntegrations: ['qbittorrent', 'sabnzbd'],
    configConstraints: {
        contentPadding: 'none',
        options: [
            {
                key: 'showStatsBar',
                label: 'Stats Bar',
                type: 'buttons',
                defaultValue: 'true',
                choices: [
                    { value: 'true', label: 'Show' },
                    { value: 'false', label: 'Hide' },
                ],
            },
        ],
    },
};
