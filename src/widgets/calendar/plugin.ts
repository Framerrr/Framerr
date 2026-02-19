/**
 * Calendar Widget Plugin
 *
 * Combined Sonarr and Radarr calendar.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Calendar } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'calendar',
    name: 'Calendar',
    description: 'Combined Sonarr and Radarr calendar',
    category: 'media',
    icon: Calendar,
    sizing: {
        default: { w: 12, h: 8 },
        min: { w: 4, h: 3 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./CalendarWidget')),
    compatibleIntegrations: ['sonarr', 'radarr'],
    multiIntegration: true,
    integrationGroups: [
        { key: 'sonarrIntegrationIds', label: 'Sonarr', types: ['sonarr'] },
        { key: 'radarrIntegrationIds', label: 'Radarr', types: ['radarr'] },
    ],
    defaultConfig: {
        viewMode: 'month',
    },
    configConstraints: {
        contentPadding: 'none',
        options: [
            {
                key: 'viewMode',
                label: 'View Mode',
                type: 'buttons',
                defaultValue: 'month',
                choices: [
                    { value: 'month', label: 'Month' },
                    { value: 'agenda', label: 'Agenda' },
                    { value: 'both', label: 'Both' },
                ],
            },
        ],
    },
};
