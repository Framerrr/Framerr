/**
 * Service Status Widget Plugin
 *
 * Monitor service uptime and health.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Server } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'service-status',
    name: 'Service Status',
    description: 'Monitor service uptime and health',
    category: 'system',
    icon: Server,
    sizing: {
        default: { w: 12, h: 2 },
        min: { w: 4, h: 1 },  // h:1 allowed - header collapses automatically (soft mode)
        max: { w: 24, h: 12 },
    },
    component: lazy(() => import('./ServiceStatusWidget')),
    compatibleIntegrations: ['monitor', 'uptimekuma'],
    configConstraints: {
        contentPadding: 'none',  // Widget handles its own padding for card layout
    },
};
