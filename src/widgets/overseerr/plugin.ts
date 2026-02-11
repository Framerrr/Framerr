/**
 * Overseerr Widget Plugin
 *
 * Media requests and discovery.
 * Supports Carousel (horizontal poster scroll) and Stacked (vertical backdrop list) modes.
 */

import { lazy } from 'react';
import { Star } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'overseerr',
    name: 'Overseerr',
    description: 'Media requests and discovery',
    category: 'media',
    icon: Star,
    sizing: {
        default: { w: 12, h: 6 },
        min: { w: 6, h: 4 },
        max: { w: 24, h: 12 },
    },
    component: lazy(() => import('./OverseerrWidget')),
    compatibleIntegrations: ['overseerr'],
    defaultConfig: {
        viewMode: 'auto',
    },
    configConstraints: {
        contentPadding: 'sm',
        options: [
            {
                key: 'viewMode',
                label: 'View Mode',
                type: 'buttons',
                defaultValue: 'auto',
                choices: [
                    { value: 'auto', label: 'Auto' },
                    { value: 'carousel', label: 'Carousel' },
                    { value: 'stacked', label: 'Stacked' },
                ]
            }
        ]
    },
};
