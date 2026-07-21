/**
 * Tautulli Widget Plugin
 *
 * Plex library statistics and analytics dashboard.
 */

import { lazy } from 'react';
import { BarChart3 } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'tautulli',
    name: 'Tautulli',
    description: 'Plex library statistics and analytics',
    category: 'media',
    icon: BarChart3,
    sizing: {
        default: { w: 6, h: 6 },
        min: { w: 6, h: 1 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./TautulliWidget')),
    compatibleIntegrations: ['tautulli'],
    configConstraints: {
        contentPadding: 'none',
        options: [
            {
                key: 'itemCount',
                label: 'List Items',
                type: 'buttons',
                defaultValue: '10',
                choices: [
                    { value: '5', label: '5' },
                    { value: '10', label: '10' },
                    { value: '20', label: '20' },
                    { value: '50', label: '50' },
                ],
            },
            {
                key: 'statsTimeRange',
                label: 'Stats Time Range',
                type: 'buttons',
                defaultValue: '90',
                choices: [
                    { value: '30', label: '1 Month' },
                    { value: '90', label: '3 Months' },
                    { value: '180', label: '6 Months' },
                    { value: '365', label: '1 Year' },
                    { value: '36500', label: 'All Time' },
                ],
            },
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
