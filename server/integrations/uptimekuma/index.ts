/**
 * Uptime Kuma Integration Plugin
 *
 * Self-contained integration for Uptime Kuma monitoring.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { UptimeKumaAdapter } from './adapter';
import * as poller from './poller';

const adapter = new UptimeKumaAdapter();

export const plugin: IntegrationPlugin = {
    id,
    name,
    description,
    category,
    icon,
    configSchema,
    adapter,
    testConnection: adapter.testConnection.bind(adapter),
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
    notificationEvents: [
        { key: 'monitor_down', label: 'Monitor Down', description: 'A monitor changed from UP to DOWN' },
        { key: 'monitor_up', label: 'Monitor Up', description: 'A monitor changed from DOWN to UP' },
    ],
};
