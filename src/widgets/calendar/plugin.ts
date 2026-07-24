/**
 * Calendar Widget Plugin
 *
 * Combined Sonarr, Radarr, and Lidarr calendar.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Calendar } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'calendar',
    name: 'Calendar',
    description: 'Combined Sonarr, Radarr, and Lidarr calendar',
    category: 'media',
    icon: Calendar,
    sizing: {
        default: { w: 12, h: 8 },
        min: { w: 4, h: 3 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./CalendarWidget')),
    compatibleIntegrations: ['sonarr', 'radarr', 'lidarr'],
    multiIntegration: true,
    integrationGroups: [
        { key: 'sonarrIntegrationIds', label: 'Sonarr', types: ['sonarr'] },
        { key: 'radarrIntegrationIds', label: 'Radarr', types: ['radarr'] },
        { key: 'lidarrIntegrationIds', label: 'Lidarr', types: ['lidarr'] },
    ],
    defaultConfig: {
        viewMode: 'month',
        startWeekOnMonday: false,
        movieDates: 'all',
        lookAheadDays: '60',
        lookBackDays: '30',
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
            {
                key: 'lookAheadDays',
                label: 'Look Ahead',
                type: 'buttons',
                defaultValue: '60',
                choices: [
                    { value: '30', label: '30d' },
                    { value: '60', label: '60d' },
                    { value: '90', label: '90d' },
                    { value: '180', label: '180d' },
                    { value: 'all', label: 'All' },
                ],
            },
            {
                key: 'lookBackDays',
                label: 'Look Back',
                type: 'buttons',
                defaultValue: '30',
                choices: [
                    { value: '0', label: '0d' },
                    { value: '7', label: '7d' },
                    { value: '30', label: '30d' },
                    { value: '90', label: '90d' },
                    { value: 'all', label: 'All' },
                ],
            },
            {
                key: 'startWeekOnMonday',
                label: 'Start Week On',
                type: 'buttons',
                defaultValue: 'false',
                choices: [
                    { value: 'false', label: 'Sunday' },
                    { value: 'true', label: 'Monday' },
                ],
                visibleWhen: { key: 'viewMode', value: ['month', 'both'] },
            },
            {
                key: 'movieDates',
                label: 'Movie Release Dates',
                type: 'buttons',
                defaultValue: 'all',
                choices: [
                    { value: 'cinema', label: 'Cinema' },
                    { value: 'digital', label: 'Digital' },
                    { value: 'physical', label: 'Physical' },
                    { value: 'all', label: 'All' },
                ],
            },
        ],
    },
};
