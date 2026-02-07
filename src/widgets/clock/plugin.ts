/**
 * Clock Widget Plugin
 *
 * Time display with timezone support.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Clock } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'clock',
    name: 'Clock',
    description: 'Time display with timezone support',
    category: 'utility',
    icon: Clock,
    sizing: {
        default: { w: 6, h: 2 },
        min: { w: 4, h: 1 },
        max: { w: 24, h: 6 },
    },
    component: lazy(() => import('./ClockWidget')),
    isGlobal: true,
    configConstraints: {
        contentPadding: 'sm',  // Compact padding for data-dense display
        options: [
            {
                key: 'displayOptions',
                label: 'Display Options',
                type: 'toggle-buttons',
                choices: [
                    { value: 'format24h', label: '24H', defaultValue: false },
                    { value: 'showSeconds', label: 'Seconds', defaultValue: false },
                    { value: 'showDate', label: 'Date', defaultValue: true }
                ]
            }
        ]
    }
};
