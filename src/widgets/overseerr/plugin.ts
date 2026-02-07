/**
 * Overseerr Widget Plugin
 *
 * Media requests and discovery.
 * P4 Phase 4.3: Widget Plugin Migration
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
    configConstraints: {
        contentPadding: 'lg',  // Relaxed padding for card layout
    },
};
