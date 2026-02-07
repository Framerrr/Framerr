/**
 * System Status Widget Plugin
 *
 * CPU, memory, and temperature monitoring.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Activity } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'system-status',
    name: 'System Status',
    description: 'CPU, memory, and temperature monitoring',
    category: 'system',
    icon: Activity,
    sizing: {
        default: { w: 12, h: 6 },
        min: { w: 6, h: 4 },
        max: { w: 24, h: 12 },
    },
    component: lazy(() => import('./SystemStatusWidget')),
    compatibleIntegrations: ['glances', 'customsystemstatus'],
    configConstraints: {
        contentPadding: 'sm',  // Compact padding - widget handles internal spacing
    },
};
