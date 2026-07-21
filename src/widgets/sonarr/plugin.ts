/**
 * Sonarr Widget Plugin
 *
 * TV show management and calendar.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { MonitorPlay } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'sonarr',
    name: 'Sonarr',
    description: 'TV show management and calendar',
    category: 'media',
    icon: MonitorPlay,
    sizing: {
        default: { w: 6, h: 6 },
        min: { w: 4, h: 3 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./SonarrWidget')),
    compatibleIntegrations: ['sonarr'],
    defaultConfig: {
        viewMode: 'auto',
        lookAheadDays: '7',
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
                key: 'lookAheadDays',
                label: 'Look Ahead',
                type: 'buttons',
                defaultValue: '7',
                choices: [
                    { value: '3', label: '3d' },
                    { value: '7', label: '7d' },
                    { value: '14', label: '14d' },
                    { value: '30', label: '30d' },
                ],
            },
            {
                key: 'showNetwork',
                label: 'Show Network',
                type: 'toggle',
                defaultValue: true,
            },
            {
                key: 'showSeasonProgress',
                label: 'Season Progress',
                type: 'toggle',
                defaultValue: true,
            },
            {
                key: 'highlightPremieres',
                label: 'Highlight Premieres',
                type: 'toggle',
                defaultValue: true,
            },
        ]
    },
};
