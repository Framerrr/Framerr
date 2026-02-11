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
    configConstraints: {
        contentPadding: 'lg',  // Relaxed padding for card layout
    },
};
