/**
 * Lidarr Widget Plugin
 *
 * Music library management and calendar.
 */

import { lazy } from 'react';
import { Music } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'lidarr',
    name: 'Lidarr',
    description: 'Music library management and calendar',
    category: 'management',
    icon: Music,
    sizing: {
        default: { w: 6, h: 6 },
        min: { w: 4, h: 3 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./LidarrWidget')),
    compatibleIntegrations: ['lidarr'],
    defaultConfig: {
        viewMode: 'auto',
        lookAheadDays: '30',
    },
    configConstraints: {
        contentPadding: 'none',
        options: [
            {
                key: 'viewMode',
                label: 'View Mode',
                type: 'buttons',
                defaultValue: 'auto',
                choices: [
                    { value: 'auto', label: 'Auto' },
                    { value: 'stacked', label: 'Stacked' },
                    { value: 'column', label: 'Column' },
                ]
            },
            {
                key: 'showStatsBar',
                label: 'Summary Bar',
                type: 'buttons',
                defaultValue: 'true',
                choices: [
                    { value: 'true', label: 'Show' },
                    { value: 'false', label: 'Hide' },
                ],
            },
            {
                key: 'lookAheadDays',
                label: 'Look Ahead',
                type: 'buttons',
                defaultValue: '30',
                choices: [
                    { value: '7', label: '7d' },
                    { value: '30', label: '30d' },
                    { value: '90', label: '90d' },
                    { value: 'all', label: 'All' },
                ],
            },
            {
                key: 'showAlbumType',
                label: 'Show Album Type',
                type: 'toggle',
                defaultValue: true,
            },
            {
                key: 'attentionVisibility',
                label: 'Needs Attention',
                type: 'toggle-buttons',
                choices: [
                    { value: 'showMissing', label: 'Missing', defaultValue: true },
                    { value: 'showUpgrades', label: 'Upgrades', defaultValue: true },
                ],
            },
        ]
    },
};
