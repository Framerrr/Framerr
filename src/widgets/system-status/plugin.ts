/**
 * System Status Widget Plugin
 *
 * CPU, memory, and temperature monitoring.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Activity } from 'lucide-react';
import type { WidgetPlugin } from '../types';
import MetricLayoutEditor from './components/MetricLayoutEditor';

export const plugin: WidgetPlugin = {
    id: 'system-status',
    name: 'System Status',
    description: 'CPU, memory, and temperature monitoring',
    category: 'system',
    icon: Activity,
    sizing: {
        default: { w: 12, h: 6 },
        min: { w: 2, h: 1 },
        max: { w: 24, h: 12 },
    },
    component: lazy(() => import('./SystemStatusWidget')),
    compatibleIntegrations: ['glances', 'customsystemstatus'],
    defaultConfig: {
        layout: 'grid',
        showCpu: true,
        showMemory: true,
        showTemperature: true,
        showUptime: true,
    },
    configConstraints: {
        contentPadding: 'none',  // Widget handles its own padding via the grid
        options: [
            {
                key: 'layout',
                label: 'Layout',
                type: 'buttons',
                defaultValue: 'grid',
                choices: [
                    { value: 'grid', label: 'Grid' },
                    { value: 'stacked', label: 'Stacked' },
                ],
            },
            {
                key: 'visibleMetrics',
                label: 'Visible Metrics',
                type: 'toggle-buttons',
                choices: [
                    { value: 'showCpu', label: 'CPU', defaultValue: true },
                    { value: 'showMemory', label: 'Memory', defaultValue: true },
                    { value: 'showTemperature', label: 'Temp', defaultValue: true },
                    { value: 'showUptime', label: 'Uptime', defaultValue: true },
                ],
            },
            {
                key: 'metricLayout',
                label: 'Metric Layout',
                type: 'component',
                component: MetricLayoutEditor,
            },
        ],
    },
};
