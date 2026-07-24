/**
 * Prowlarr Widget Plugin
 *
 * Indexer health monitoring for Prowlarr.
 */

import { lazy } from 'react';
import { Search } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'prowlarr',
    name: 'Prowlarr',
    description: 'Indexer health and status monitoring',
    category: 'management',
    icon: Search,
    sizing: {
        default: { w: 6, h: 6 },
        min: { w: 4, h: 3 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./ProwlarrWidget')),
    compatibleIntegrations: ['prowlarr'],
    configConstraints: {
        contentPadding: 'none',
        options: [
            {
                key: 'showSummaryBar',
                label: 'Summary Bar',
                type: 'buttons',
                defaultValue: 'true',
                choices: [
                    { value: 'true', label: 'Show' },
                    { value: 'false', label: 'Hide' },
                ],
            },
            {
                key: 'showApplications',
                label: 'Applications',
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
