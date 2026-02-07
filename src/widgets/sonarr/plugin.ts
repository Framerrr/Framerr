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
        min: { w: 6, h: 3 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./SonarrWidget')),
    compatibleIntegrations: ['sonarr'],
    configConstraints: {
        contentPadding: 'lg',  // Relaxed padding for card layout
    },
};
