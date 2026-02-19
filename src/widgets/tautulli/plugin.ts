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
                label: 'Items to Show',
                type: 'buttons',
                defaultValue: '5',
                choices: [
                    { value: '5', label: '5' },
                    { value: '10', label: '10' },
                    { value: '15', label: '15' },
                    { value: '20', label: '20' },
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
