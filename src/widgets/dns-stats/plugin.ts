import { lazy } from 'react';
import { Shield } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'dns-stats',
    name: 'DNS Stats',
    description: 'DNS filtering stats for AdGuard Home and Pi-hole',
    category: 'management',
    icon: Shield,
    sizing: {
        default: { w: 6, h: 6 },
        min: { w: 4, h: 4 },
        max: { w: 24, h: 12 },
    },
    component: lazy(() => import('./DnsStatsWidget')),
    compatibleIntegrations: ['adguard', 'pihole'],
    configConstraints: {
        contentPadding: 'md',
        options: [
            {
                key: 'sectionVisibility',
                label: 'Show Sections',
                type: 'toggle-buttons',
                choices: [
                    { value: 'showTopBlocked', label: 'Top Blocked', defaultValue: true },
                    { value: 'showTopClients', label: 'Top Clients', defaultValue: true },
                    { value: 'showSparkline', label: 'Activity', defaultValue: true },
                    { value: 'showTopQueried', label: 'Top Queried', defaultValue: true },
                    { value: 'showTopUpstreams', label: 'Top Upstreams', defaultValue: true },
                ],
            },
        ],
    },
};
