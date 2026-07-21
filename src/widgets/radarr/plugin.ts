/**
 * Radarr Widget Plugin
 *
 * Movie management and calendar.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Film } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'radarr',
    name: 'Radarr',
    description: 'Movie management and calendar',
    category: 'media',
    icon: Film,
    sizing: {
        default: { w: 6, h: 6 },
        min: { w: 4, h: 3 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./RadarrWidget')),
    compatibleIntegrations: ['radarr'],
    defaultConfig: {
        viewMode: 'auto',
        sortBy: 'nextDate',
        lookAheadDays: '30',
    },
    configConstraints: {
        contentPadding: 'none',  // Widget handles its own padding internally
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
                key: 'sortBy',
                label: 'Sort By',
                type: 'buttons',
                defaultValue: 'nextDate',
                choices: [
                    { value: 'nextDate', label: 'Next Date' },
                    { value: 'cinema', label: 'Cinema' },
                    { value: 'digital', label: 'Digital' },
                    { value: 'physical', label: 'Physical' },
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
                key: 'releasePillVisibility',
                label: 'Show Release Types',
                type: 'toggle-buttons',
                choices: [
                    { value: 'showCinema', label: 'Cinema', defaultValue: true },
                    { value: 'showDigital', label: 'Digital', defaultValue: true },
                    { value: 'showPhysical', label: 'Physical', defaultValue: true },
                ],
            },
        ]
    },
};
