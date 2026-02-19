/**
 * System Status Widget Plugin
 *
 * CPU, memory, and temperature monitoring.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Activity } from 'lucide-react';
import type { WidgetPlugin } from '../types';
import DiskConfigPanel from './components/DiskConfigPanel';
import MetricLayoutEditor from './components/MetricLayoutEditor';

export const plugin: WidgetPlugin = {
    id: 'system-status',
    name: 'System Status',
    description: 'System metrics monitoring — CPU, memory, temperature, disk, and network',
    category: 'system',
    icon: Activity,
    sizing: {
        default: { w: 12, h: 6 },
        min: { w: 2, h: 1 },
        max: { w: 24, h: 12 },
    },
    component: lazy(() => import('./SystemStatusWidget')),
    compatibleIntegrations: ['glances', 'customsystemstatus', 'unraid'],
    defaultConfig: {
        layout: 'grid',
        showCpu: true,
        showMemory: true,
        showTemperature: true,
        showUptime: true,
        showDiskUsage: true,
        showNetworkUp: true,
        showNetworkDown: true,
        diskCollapsed: 'collapsed',
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
                    { value: 'showDiskUsage', label: 'Disk', defaultValue: true },
                    { value: 'showNetworkUp', label: 'Net ↑', defaultValue: true },
                    { value: 'showNetworkDown', label: 'Net ↓', defaultValue: true },
                ],
            },
            {
                key: 'diskConfig',
                label: '',
                type: 'component',
                component: DiskConfigPanel,
                visibleWhen: { key: 'showDiskUsage', value: [true, undefined] },
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
